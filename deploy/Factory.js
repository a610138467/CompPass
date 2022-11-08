module.exports = async function ({
    ethers,
    getNamedAccounts,
    deployments,
    getChainId,
    getUnnamedAccounts,
}) {
    const {deploy} = deployments;
    const {deployer} = await ethers.getNamedSigners();

    await deploy('Factory', {
        from: deployer.address,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

module.exports.tags = ["Factory"];
module.exports.dependencies = [];
