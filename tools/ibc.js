#!/usr/bin/env nodejs

const WebSocket = require('ws');
require('dotenv').config();
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');

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
    version:3.1 //Can fetch from get_info
}];

// jungle : ibcvotetest1
// waxtest : ibcvoteprove

const eosioObj = (chain_name) => {
    const chain_data = chainData(chain_name);

    const signatureProvider = new JsSignatureProvider([process.env.IBC_PROOF_PRIVATE_KEY]);
    const rpc = new JsonRpc(chain_data.nodeUrl, { fetch });
    const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

    return api;
}

const chainData = (name) => {
    const chain = chains.find(c => {
        return c.name === name;
    });
    if (chain){
        return chain;
    }

    throw new Error(`Could not find chain data for ${name}`);
}

const lastProvenBlock = async (destination_chain_name, source_chain_name) => {
    const destination_chain_data = chainData(destination_chain_name);
    const url = `${destination_chain_data.nodeUrl}/v1/chain/get_table_rows`;
    const post_data = JSON.stringify({
        reverse: true,
        json: true,
        code: destination_chain_data.bridgeContract,
        scope: source_chain_name,
        table: 'lastproofs',
        limit: 1
    });
    const res = await fetch(url, {
        method: 'POST',
        body: post_data
    });
    const json = await res.json();
    if (!json.rows.length){
        throw new Error('Could not find last proven block');
    }
    return json.rows[0].block_height;
}

const getProofRequestData = async (source_chain_name, destination_chain_name, tx_id, action_name, type = 'heavyProof') => {
    const chain_data = chainData(source_chain_name);
    const block_data = await getActionBlockData(destination_chain_name, source_chain_name, tx_id, action_name, (type === 'lightProof'));

    return new Promise( (resolve, reject) => {
        //initialize socket to proof server
        const ws = new WebSocket(chain_data.proofSocket);
        ws.addEventListener('open', async (event) => {
            // connected to websocket server
            const query = { type: 'getBlockActions', block_to_prove: block_data.block_to_prove };
            ws.send(JSON.stringify(query));
        });

        ws.addEventListener('error', (event) => {
            console.error(`WebSocket error: ${event.message}`);
        })

        //messages from websocket server
        ws.addEventListener('message', (event) => {
            const res = JSON.parse(event.data);
            //log non-progress messages from ibc server
            if (res.type !=='progress') console.log("Received message from ibc getBlockActions", res);
            if (res.type !=='getBlockActions') return;
            if (res.type === 'error') reject(res.error);
            ws.close();
            const action_receipt = res.txs.filter(t => {
                return t[0].transactionId === tx_id;
            });
            const action = action_receipt[0][0].action;
            action.receipt = action_receipt[0][0].receipt;
            resolve({type, action, ...block_data});
        });
    });
}
const getActionBlockData = async (destination_chain_name, source_chain_name, tx_id, action_name, light_proof = false) => {
    const chain_data = chainData(source_chain_name);
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

    const data = {block_to_prove: action_data.block_num};
    if (light_proof){
        data.last_proven_block = await lastProvenBlock(destination_chain_name, source_chain_name);
    }
    return data;
}

const getProof = (chain_name, {type, block_to_prove, action, last_proven_block, action_receipt_digest}) => {
    const chain_data = chainData(chain_name);

    return new Promise((resolve, reject) => {
        //initialize socket to proof server
        const ws = new WebSocket(chain_data.proofSocket);
        ws.addEventListener('open', (event) => {
            // connected to websocket server
            const query = { type, block_to_prove };
            if (type === 'lightProof'){
                query.last_proven_block = last_proven_block;
                query.action_receipt_digest = action_receipt_digest;
            }
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
            resolve(res);
        });
    });
}

const getProveActionData = async (chain_name, request_data, proof_data) => {
    const chain_data = chainData(chain_name);

    // console.log(request_data, proof_data);

    const actionData = {
        authorization: [{
            actor: process.env.IBC_PROOF_ACCOUNT,
            permission: process.env.IBC_PROOF_PERMISSION
        }],
        name: 'prove',
        account: chain_data.proveContract,
        data: { ...proof_data.proof, prover: process.env.IBC_PROOF_ACCOUNT }
    };

    // console.log(request_data);

    let auth_sequence = [];
    // console.log(request_data.action.receipt.auth_sequence);
    for (let authSequence of request_data.action.receipt.auth_sequence) auth_sequence.push({ account: authSequence[0], sequence: authSequence[1] });
    actionData.data.actionproof = {
        ...proof_data.proof.actionproof,
        action: {
            account: request_data.action.account,
            name: request_data.action.name,
            authorization: request_data.action.authorization,
            data: request_data.action.data
        },
        receipt: { ...request_data.action.receipt }
    }

    return actionData;
}

const sendAction = async (chain_name, action_data) => {
    const api = eosioObj(chain_name);
    const result = await api.transact({
        actions: [action_data]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
    return result;
}

const run = async (env, tx_id) => {
    try {
        let src = 'jungle4';
        let dest = 'waxtestnet';
        switch (env){
            case 'test':
                break;
            case 'main':
                src = 'eos';
                dest = 'wax';
                break;
            default:
                console.error(`Invalid environment supplied (${env}), must be test or main`);
                process.exit(1);
        }
        const request_data = await getProofRequestData(src, dest, tx_id, 'vote');
        // console.log(JSON.stringify(request_data, ' ', 4));
        const proof_data = await getProof(src, request_data);
        // console.log(proof_data);
        const action_data = await getProveActionData(dest, request_data, proof_data);
        // console.log(JSON.stringify(action_data, ' ', 4));
        const result = await sendAction(dest, action_data);
        console.log(result);
    }
    catch (e){
        console.error(e.message);
        process.exit(1);
    }
}

if (process.argv.length < 4){
    console.error('Usage: ibc.js <test|main> <transaction_id>');
    process.exit(1);
}


// example tx on jungle4 44197dd22967422138665ab0984a43bb0adc91f69b7f82926dd8fee1032c18de
run(process.argv[2], process.argv[3]);