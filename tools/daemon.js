#!/usr/bin/env nodejs

require('dotenv').config();
const { chainData } = require('./lib/chains');
const { getProofRequestData, getProof, getProveActionData, sendAction } = require('./lib/ibc_helpers');
const { transactionFinal } = require('./lib/eosio_helpers');
/*
Polls hyperion to check for new actions which have to be proven on the destination chain
 */

const sleep = async (ms) => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

const getLastVoteTx = async (chain_name) => {
    const chain_data = chainData(chain_name);
    let tx_id = null;
    let block_num = null;
    try {
        const url = `${chain_data.hyperion}/v2/history/get_actions?filter=${chain_data.voteContract}:vote&limit=1`;
        console.log(url);
        const res = await fetch(url);
        const json = await res.json();
        if (json && json.actions.length){
            console.log(json.actions[0]);
            tx_id = json.actions[0].trx_id;
            block_num = json.actions[0].block_num;
        }
    }
    catch (e){
        console.error(`Error fetching last vote action : ${e.message}`);
    }

    return { tx_id, block_num };
}

// const poll_time = 5 * 1000; // in ms
const poll_time = 60 * 1000; // in ms
let last_proven_tx = '';
const run = async () => {
    let src = 'jungle4';
    let dest = 'waxtestnet';

    const env = process.env.IBC_ENVIRONMENT;
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

    while (true){
        // console.log(`Checking for new transactions on source chain`);

        const { tx_id, block_num } = await getLastVoteTx(src);
        if (tx_id && tx_id !== last_proven_tx){
            // wait for finality
            while (!await transactionFinal(src, tx_id, block_num)){
                await sleep(60000);
            }

            console.log(`Sending proof for ${tx_id}`);

            let action_data;
            try {
                const request_data = await getProofRequestData(src, dest, tx_id, 'vote');
                // console.log(JSON.stringify(request_data, ' ', 4));
                const proof_data = await getProof(src, request_data);
                // console.log(proof_data);
                action_data = await getProveActionData(dest, request_data, proof_data);
            }
            catch (e){
                console.error(`Error getting prove data ${e.message}`);
            }
            // console.log(JSON.stringify(action_data, ' ', 4));
            try {
                const result = await sendAction(dest, action_data);
                last_proven_tx = tx_id;
            }
            catch (e){
                // console.log(e.message);
                if (e.message.indexOf('action already proved') > -1){
                    console.log(`Action already proved`);
                    last_proven_tx = tx_id;
                }
                else {
                    console.error(e.message);
                }
            }
        }

        await sleep(poll_time);
    }
}

run();