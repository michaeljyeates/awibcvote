#!/usr/bin/env nodejs

const WebSocket = require('ws');

const chains = [{
    chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
    nodeUrl: 'https://test.wax.eosusa.io',
    name: "waxtestnet",
    label: "WAX Testnet",
    txExplorer: "https://wax-test.bloks.io/transaction",
    proofSocket: "wss://wax-testnet-ibc.goldenplatform.com",
    bridgeContract:"antelopeibc2",
},{
    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
    nodeUrl: 'https://jungle4.api.eosnation.io', //api supporting send_transaction2
    hyperion: 'https://jungle.eosusa.io',
    txExplorer: 'https://jungle4.eosq.eosnation.io/tx',
    name: "jungle4",
    label: "Jungle4 (EOS) Testnet",
    proofSocket: "wss://jungle4-ibc.goldenplatform.com",
    bridgeContract:"antelopeibc2",
    version:3.1 //Can fetch from get_info
}];

const chainData = (name) => {
    const chainArr = chains.filter(c => {
        return c.name === name;
    });
    if (chainArr.length){
        return chainArr[0];
    }

    throw new Error(`Could not find chain data for ${name}`);
}
const getProofRequestData = async (chain_name, tx_id, action_name) => {
    const chain_data = chainData(chain_name);
    const url = `${chain_data['hyperion']}/v2/history/get_transaction?id=${tx_id}`;
    const res = await fetch(url);
    const body = await res.json();
    // console.log(body);
    const action_data = body.actions.find(a => {
        return a.act.name === action_name;
    });
    if (!action_data){
        throw new Error(`Could not find action receipt with name ${action_name}`);
    }
    // console.log(action_data);
    const receipt = action_data.receipts[0];
    receipt.code_sequence = action_data.code_sequence;
    receipt.abi_sequence = action_data.abi_sequence;
    receipt.act_digest = action_data.act_digest;
    // console.log(receipt);
    return {type: 'lightProof', block_to_prove: action_data.block_num, action: {receipt}};
}

const getProof = (chain_name, {type, block_to_prove, action}) => {
    const chain_data = chainData(chain_name);

    return new Promise((resolve, reject) => {
        //initialize socket to proof server
        const ws = new WebSocket(chain_data.proofSocket);
        ws.addEventListener('open', (event) => {
            // connected to websocket server
            const query = { type, block_to_prove };
            if (action) query.action_receipt = action.receipt;
            ws.send(JSON.stringify(query));
        });

        //messages from websocket server
        ws.addEventListener('message', (event) => {
            const res = JSON.parse(event.data);
            //log non-progress messages from ibc server
            if (res.type !=='progress') console.log("Received message from ibc proof server", res);
            // if (res.type =='progress') $('.progressDiv').last().html(res.progress +"%");
            if (res.type !=='proof') return;
            if (res.type === 'error') reject(res.error);
            ws.close();
            //
            // // $('.progressDiv').last().html("100%");
            // //handle issue/withdraw if proving transfer/retire 's emitxfer action, else submit block proof to bridge directly (for schedules)
            // const actionToSubmit = {
            //     authorization: [destinationChain.auth],
            //     name: !action ? "checkproofd" : tokenRow.native ? "issuea" : "withdrawa",
            //     account: !action ? destinationChain.bridgeContract : tokenRow.native ? tokenRow.pairedWrapTokenContract : tokenRow.wrapLockContract,
            //     data: { ...res.proof, prover: destinationChain.auth.actor }
            // };
            //
            // //if proving an action, add action and formatted receipt to actionproof object
            // if (action) {
            //     let auth_sequence = [];
            //     for (var authSequence of action.receipt.auth_sequence) auth_sequence.push({ account: authSequence[0], sequence: authSequence[1] });
            //     actionToSubmit.data.actionproof = {
            //         ...res.proof.actionproof,
            //         action: {
            //             account: action.act.account,
            //             name: action.act.name,
            //             authorization: action.act.authorization,
            //             data: action.act.hex_data
            //         },
            //         receipt: { ...action.receipt, auth_sequence }
            //     }
            // }
            resolve(res);
        });
    });
}

const run = async () => {
    try {
        const request_data = await getProofRequestData('jungle4', '44197dd22967422138665ab0984a43bb0adc91f69b7f82926dd8fee1032c18de', 'vote');
        console.log(request_data);
        const proof_data = await getProof('jungle4', request_data);
    }
    catch (e){
        console.error(e.message);
        process.exit(1);
    }
}

run();