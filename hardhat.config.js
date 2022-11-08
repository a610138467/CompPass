require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('hardhat-spdx-license-identifier');
require('hardhat-deploy');
require('hardhat-abi-exporter');
require('@nomiclabs/hardhat-ethers');
require('dotenv/config');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-contract-sizer');
require("hardhat-log-remover");

let accounts = []
var fs = require('fs')
var read = require('read')
var util = require('util')
const keythereum = require('keythereum')
const prompt = require('prompt-sync')()
;(async function () {
    try {
        const root = '.keystore'
        var pa = fs.readdirSync(root)
        for (let index = 0; index < pa.length; index++) {
            let ele = pa[index]
            let fullPath = root + '/' + ele
            var info = fs.statSync(fullPath)
            //console.dir(ele);
            if (!info.isDirectory() && ele.endsWith('.keystore')) {
                const content = fs.readFileSync(fullPath, 'utf8')
                const json = JSON.parse(content)
                const password = prompt('Input password for 0x' + json.address + ': ', { echo: '*' })
                //console.dir(password);
                const privatekey = keythereum.recover(password, json).toString('hex')
                //console.dir(privatekey);
                accounts.push('0x' + privatekey)
                //console.dir(keystore);
            }
        }
    } catch (ex) {}
    try {
        const file = '.secret'
        var info = fs.statSync(file)
        if (!info.isDirectory()) {
            const content = fs.readFileSync(file, 'utf8')
            let lines = content.split('\n')
            for (let index = 0; index < lines.length; index++) {
                let line = lines[index]
                if (line == undefined || line == '') {
                    continue
                }
                if (!line.startsWith('0x') || !line.startsWith('0x')) {
                    line = '0x' + line
                }
                accounts.push(line)
            }
        }
    } catch (ex) {}
})()

module.exports = {
    defaultNetwork: 'hardhat',
    abiExporter: {
        path: './abi',
        clear: false,
        flat: true,
        // only: [],
        // except: []
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },

    networks: {
        bscmain: {
            url: `https://bsc-dataseed1.defibit.io/`,
            accounts: accounts,
            chainId: 56,
            gasMultiplier: 3,
            gasPrice: 5.5 * 1000000000,
            tags: ["mainnet"],
        },
        ethmain: {
            url: `https://mainnet.infura.io/v3/` + process.env.INFURA_KEY,
            accounts: accounts,
            chainId: 1,
            gasMultiplier: 3,
            //gasPrice: 10 * 1000000000,
            tags: ["mainnet"],
        },
        bsctest: {
            url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
            accounts: accounts,
            chainId: 97,
            gasMultiplier: 2,
            tags: ['test'],
        },
        ropsten: {
            url: `https://ropsten.infura.io/v3/` + process.env.INFURA_KEY,
            accounts: accounts,
            chainId: 3,
            gasMultiplier: 2,
            tags: ['test', 'local'],
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/` + process.env.INFURA_KEY,
            accounts: accounts,
            chainId: 4,
            gasMultiplier: 2,
            tags: ['test'],
        },
        hardhat: {
            forking: {
                enabled: false,
                //url: `https://bsc-dataseed1.defibit.io/`
                url: `http://127.0.0.1`
            },
            live: true,
            saveDeployments: false,
            tags: ['local'],
            timeout: 2000000,
        },
    },
    solidity: {
        compilers: [
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.0',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    spdxLicenseIdentifier: {
        overwrite: true,
        runOnCompile: true,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: false
    },
    mocha: {
        timeout: 2000000,
    },
    etherscan: {
        apiKey: process.env.API_KEY,
    },
}
