const chai = require("chai");
const expect = chai.expect;
//console.dir(chai);
//chai.should()
//chai.use(chaiAsPromised)

const INIT_CODE = "0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3";
const TRANSACTION = {
    type: "tuple[]",
    name: "_txs",
    components: [
        { name: "delegateCall", type: 'bool' },
        { name: "revertOnError", type: 'bool' },
        { name: "gasLimit", type: 'uint' },
        { name: "target", type: 'address' },
        { name: "value", type: 'uint' },
        { name: "data", type: 'bytes' },
    ]
}

describe("MAIN", () => {
    before(async function () {
        const {deployer} = await ethers.getNamedSigners();
        this.deployer = deployer;
        let signers = await ethers.getSigners();
        this.user = signers[1];
        this.receiver = signers[2];
        this.fee = signers[3];
        this.signer1 = signers[6];
        this.signer2 = signers[7];
        this.signer3 = signers[8];

        await deployments.fixture(["Factory", "MainModule"]);

        this.Factory = await ethers.getContract('Factory');
        this.MainModule = await ethers.getContract('MainModule');
        let MockERC20Factory = await ethers.getContractFactory('MockERC20');
        let MockERC20 = await MockERC20Factory.deploy("Mock", "Mock", 18);
        this.MockERC20 = await MockERC20.deployed();

        let CallReceiverMockFactory = await ethers.getContractFactory('CallReceiverMock');
        let CallReceiverMock = await CallReceiverMockFactory.deploy();
        this.CallReceiverMock = await CallReceiverMock.deployed();
    });

    beforeEach(async function () {
    });

    it("deploy", async function() {
        let email = '12345678@gmail.com';
        let weight = '100';
        let signers = [
            {
                "address": this.signer1.address,
                "weight": "50",
            },
            {
                "address": this.signer2.address,
                "weight": "50",
            },
            {
                "address": this.signer3.address,
                "weight": "50",
            },
            {
                "address": ethers.utils.id(email).substr(0, 42),
                "weight": "50",
            }
        ]
        let imageHash = ethers.utils.hexZeroPad(ethers.BigNumber.from(weight).toHexString(), 32);
        for (let i = 0; i < signers.length; i ++) {
            imageHash = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        'bytes32',
                        'uint',
                        'address'
                    ],
                    [
                        imageHash,
                        signers[i].weight,
                        signers[i].address,
                    ]
                )
            )
        }
        //console.log("imageHash: ", imageHash);
        let initCode = await ethers.utils.solidityPack(["bytes", "uint"], [INIT_CODE, this.MainModule.address]);
        let walletAddress = ethers.utils.getCreate2Address(this.Factory.address, imageHash, ethers.utils.keccak256(initCode));
        await this.Factory.deploy(this.MainModule.address, imageHash);
        this.Wallet = await ethers.getContractAt('MainModule', walletAddress);
        this.imageHash = imageHash;
        this.signers = signers;
        this.weight = weight;
        this.email = email;
        this.NONCE = 0;
        this.chainId = (await  await ethers.provider.getNetwork()).chainId;
    });

    it("Native", async function() {
        let txs = [
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.receiver.address,
                "value": ethers.utils.parseEther('1').toString(),
                "data": '0x',
            },
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.fee.address,
                "value": ethers.utils.parseEther('0.01').toString(),
                "data": '0x',
            },
        ];
        let txsData = ethers.utils.defaultAbiCoder.encode(
            [
                'uint', 
                TRANSACTION,
            ],
            [
                this.NONCE,
                txs,
            ],
        );
        let digest = ethers.utils.keccak256(txsData);
        let eip712Digest = ethers.utils.solidityPack(["bytes", "uint256", "address", "bytes32"], ["0x1901", this.chainId, this.Wallet.address, digest]);
        //console.log("eip712Digest: ", eip712Digest);
        let transactionHash = ethers.utils.keccak256(eip712Digest);
        let signature1 = await this.signer1.signMessage(ethers.utils.arrayify(transactionHash)) + "02";
        let signature2 = await this.signer2.signMessage(ethers.utils.arrayify(transactionHash)) + "02";
        let signature = ethers.utils.solidityPack(
            [
                'uint16', 
                'uint8', 'uint8', 'bytes', 
                'uint8', 'uint8', 'bytes',
                'uint8', 'uint8', 'address',
                'uint8', 'uint8', 'address',
            ], 
            [
                this.weight, 
                '0', this.signers[0].weight, signature1, 
                '0', this.signers[1].weight, signature2,
                '1', this.signers[2].weight, this.signers[2].address,
                '1', this.signers[3].weight, this.signers[3].address,
            ]
        );
        //console.log(signature);
        //console.log("imageHash: ", this.imageHash);
        await network.provider.send(
            "hardhat_setBalance", 
            [
                this.Wallet.address,
                ethers.utils.hexValue(ethers.utils.parseEther('1.02')),
            ]
        );
        let receiverBalanceBefore = await ethers.provider.getBalance(this.receiver.address);
        let walletBalanceBefore = await ethers.provider.getBalance(this.Wallet.address);
        let feeBalanceBefore = await ethers.provider.getBalance(this.fee.address);
        await this.Wallet.connect(this.user).execute(txs, this.NONCE ++, signature);
        let receiverBalanceAfter = await ethers.provider.getBalance(this.receiver.address);
        let walletBalanceAfter = await ethers.provider.getBalance(this.Wallet.address);
        let feeBalanceAfter = await ethers.provider.getBalance(this.fee.address);
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal(ethers.utils.parseEther('1'));
        expect(feeBalanceAfter.sub(feeBalanceBefore)).to.be.equal(ethers.utils.parseEther('0.01'));
        expect(walletBalanceBefore.sub(walletBalanceAfter)).to.be.equal(ethers.utils.parseEther('1.01'));
        expect(walletBalanceAfter).to.be.equal(ethers.utils.parseEther('0.01'));
    });

    it("ERC20", async function() {
        await this.MockERC20.mint(this.Wallet.address, ethers.utils.parseEther('100'));
        let ERC20ABI = [
            "function transfer(address to, uint amount)"
        ];
        ERC20ABI = new ethers.utils.Interface(ERC20ABI);
        //console.log(ERC20ABI);
        let txs = [
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.MockERC20.address,
                "value": '0',
                "data": ERC20ABI.encodeFunctionData("transfer", [this.receiver.address, ethers.utils.parseEther('15').toString()]),
            },
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.MockERC20.address,
                "value": '0',
                "data": ERC20ABI.encodeFunctionData("transfer", [this.fee.address, ethers.utils.parseEther('0.9').toString()]),
            },
        ];
        let txsData = ethers.utils.defaultAbiCoder.encode(
            [
                'uint', 
                TRANSACTION,
            ],
            [
                this.NONCE,
                txs,
            ],
        );
        let digest = ethers.utils.keccak256(txsData);
        let eip712Digest = ethers.utils.solidityPack(["bytes", "uint256", "address", "bytes32"], ["0x1901", this.chainId, this.Wallet.address, digest]);
        //console.log("eip712Digest: ", eip712Digest);
        let transactionHash = ethers.utils.keccak256(eip712Digest);
        let signature1 = await this.signer1.signMessage(ethers.utils.arrayify(transactionHash)) + "02";
        let signature2 = await this.signer2.signMessage(ethers.utils.arrayify(transactionHash)) + "02";
        let signature = ethers.utils.solidityPack(
            [
                'uint16', 
                'uint8', 'uint8', 'bytes', 
                'uint8', 'uint8', 'bytes',
                'uint8', 'uint8', 'address',
                'uint8', 'uint8', 'address',
            ], 
            [
                this.weight, 
                '0', this.signers[0].weight, signature1, 
                '0', this.signers[1].weight, signature2,
                '1', this.signers[2].weight, this.signers[2].address,
                '1', this.signers[3].weight, this.signers[3].address,
            ]
        );
        //console.log(signature);
        //console.log("imageHash: ", this.imageHash);
        let receiverBalanceBefore = await this.MockERC20.balanceOf(this.receiver.address);
        let walletBalanceBefore = await this.MockERC20.balanceOf(this.Wallet.address);
        let feeBalanceBefore = await this.MockERC20.balanceOf(this.fee.address);
        await this.Wallet.connect(this.user).execute(txs, this.NONCE ++, signature);
        let receiverBalanceAfter = await this.MockERC20.balanceOf(this.receiver.address);
        let walletBalanceAfter = await this.MockERC20.balanceOf(this.Wallet.address);
        let feeBalanceAfter = await this.MockERC20.balanceOf(this.fee.address);
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal(ethers.utils.parseEther('15'));
        expect(feeBalanceAfter.sub(feeBalanceBefore)).to.be.equal(ethers.utils.parseEther('0.9'));
        expect(walletBalanceBefore.sub(walletBalanceAfter)).to.be.equal(ethers.utils.parseEther('15.9'));
        expect(walletBalanceAfter).to.be.equal(ethers.utils.parseEther('84.1'));
    });

    it("CALL", async function() {
        let ABI = [
            "function transfer(address to, uint amount)",
            "function setRevertFlag(bool _revertFlag)",
            "function testCall(uint256 _valA, bytes calldata _valB)",
        ];
        ABI = new ethers.utils.Interface(ABI);
        //console.log(ABI);
        let txs = [
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.CallReceiverMock.address,
                "value": '0',
                "data": ABI.encodeFunctionData("setRevertFlag", [true]),
            },
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.CallReceiverMock.address,
                "value": '0',
                "data": ABI.encodeFunctionData("testCall", [100, "0xa0"]),
            },
            {
                "delegateCall": false,
                "revertOnError": true,
                "gasLimit": 0,
                "target": this.MockERC20.address,
                "value": '0',
                "data": ABI.encodeFunctionData("transfer", [this.fee.address, ethers.utils.parseEther('0.9').toString()]),
            },
        ];
        let txsData = ethers.utils.defaultAbiCoder.encode(
            [
                'uint', 
                TRANSACTION,
            ],
            [
                this.NONCE,
                txs,
            ],
        );
        let digest = ethers.utils.keccak256(txsData);
        let eip712Digest = ethers.utils.solidityPack(["bytes", "uint256", "address", "bytes32"], ["0x1901", this.chainId, this.Wallet.address, digest]);
        //console.log("eip712Digest: ", eip712Digest);
        let transactionHash = ethers.utils.keccak256(eip712Digest);
        let signature1 = await this.signer1.signMessage(ethers.utils.arrayify(transactionHash)) + "02";
        let signature2 = await this.signer2.signMessage(ethers.utils.arrayify(transactionHash)) + "02";
        let signature = ethers.utils.solidityPack(
            [
                'uint16', 
                'uint8', 'uint8', 'bytes', 
                'uint8', 'uint8', 'bytes',
                'uint8', 'uint8', 'address',
                'uint8', 'uint8', 'address',
            ], 
            [
                this.weight, 
                '0', this.signers[0].weight, signature1, 
                '0', this.signers[1].weight, signature2,
                '1', this.signers[2].weight, this.signers[2].address,
                '1', this.signers[3].weight, this.signers[3].address,
            ]
        );
        //console.log(signature);
        //console.log("imageHash: ", this.imageHash);
        let receiverBalanceBefore = await this.MockERC20.balanceOf(this.receiver.address);
        let walletBalanceBefore = await this.MockERC20.balanceOf(this.Wallet.address);
        let feeBalanceBefore = await this.MockERC20.balanceOf(this.fee.address);
        await this.Wallet.connect(this.user).execute(txs, this.NONCE ++, signature);
        let walletBalanceAfter = await this.MockERC20.balanceOf(this.Wallet.address);
        let feeBalanceAfter = await this.MockERC20.balanceOf(this.fee.address);
        expect(feeBalanceAfter.sub(feeBalanceBefore)).to.be.equal(ethers.utils.parseEther('0.9'));
        expect(walletBalanceBefore.sub(walletBalanceAfter)).to.be.equal(ethers.utils.parseEther('0.9'));
        expect(walletBalanceAfter).to.be.equal(ethers.utils.parseEther('83.2'));
        expect(await this.CallReceiverMock.lastValA()).to.be.equal('100');
        expect(await this.CallReceiverMock.lastValB()).to.be.equal('0xa0');
    });

});
