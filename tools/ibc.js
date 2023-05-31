#!/usr/bin/env nodejs

const WebSocket = require('ws');
require('dotenv').config();
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');

const { chainData } = require('./lib/chains');
const { eosioObj } = require('./lib/eosio_helpers');
const { lastProvenBlock, getProofRequestData, getActionBlockData, getProof, getProveActionData, sendAction } = require('./lib/ibc_helpers');

// jungle : ibcvotetest1
// waxtest : ibcvoteprove


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
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    }
}

if (process.argv.length < 4){
    console.error('Usage: ibc.js <test|main> <transaction_id>');
    process.exit(1);
}


// example tx on jungle4 44197dd22967422138665ab0984a43bb0adc91f69b7f82926dd8fee1032c18de
run(process.argv[2], process.argv[3]);