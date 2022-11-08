module.exports = async function ({
    ethers,
    getNamedAccounts,
    deployments,
    getChainId,
    getUnnamedAccounts,
}) {
    const {deploy} = deployments;
    const {deployer} = await ethers.getNamedSigners();
    let factory = await ethers.getContract('Factory');
    await deploy('MainModule', {
        from: deployer.address,
        args: [factory.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

module.exports.tags = ["MainModule"];
module.exports.dependencies = ['Factory'];
