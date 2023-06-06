
const chains = [{
    chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
    nodeUrl: 'https://test.wax.eosusa.io',
    name: "waxtestnet",
    label: "WAX Testnet",
    proofSocket: "wss://wax-testnet-ibc.goldenplatform.com",
    bridgeContract:"antelopeibc2",
    proveContract: "ibcvoteprove"
},{
    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
    nodeUrl: 'https://jungle4.api.eosnation.io', //api supporting send_transaction2
    hyperion: 'https://jungle.eosusa.io',
    name: "jungle4",
    label: "Jungle4 (EOS) Testnet",
    proofSocket: "wss://jungle4-ibc.goldenplatform.com",
    bridgeContract:"antelopeibc2",
    voteContract: "ibcvotetest1"
},{
    chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    nodeUrl: 'https://wax.eosdac.io',
    name: "wax",
    label: "WAX",
    proofSocket: "wss://ibc-server.uxnetwork.io/wax",
    bridgeContract: "ibc.prove",
    proveContract: "eden1.aioshi"
},{
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    nodeUrl: 'https://eos.api.eosnation.io', //api supporting send_transaction2
    hyperion: 'https://eos.eosusa.io',
    name: "eos",
    label: "EOS",
    proofSocket: "wss://ibc-server.uxnetwork.io/eos",
    bridgeContract:"ibc.prove",
    voteContract: "eosibceosibc"
}];


const chainData = (name) => {
    const chain = chains.find(c => {
        return c.name === name;
    });
    if (chain){
        return chain;
    }

    throw new Error(`Could not find chain data for ${name}`);
}

module.exports = { chains, chainData };