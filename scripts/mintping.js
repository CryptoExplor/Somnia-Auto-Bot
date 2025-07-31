const Web3 = require('web3');
const fs = require('fs');

// Config
const SOMNIA_TESTNET_RPC_URL = 'https://dream-rpc.somnia.network'; // Updated RPC URL
const SOMNIA_TESTNET_EXPLORER_URL = 'https://shannon-explorer.somnia.network';
const SHUFFLE_WALLETS = true;
const MINT_PONGPING_SLEEP_RANGE = [100, 300]; // seconds

/**
 * Checks if a given string is a valid Ethereum private key.
 * @param {string} key - The private key to validate.
 * @returns {boolean} - True if the key is valid, false otherwise.
 */
function isValidPrivateKey(key) {
    key = key.trim();
    if (!key.startsWith('0x')) key = '0x' + key;
    try { // Added try-catch block for robustness
        return /^0x[a-fA-F0-9]{64}$/.test(key);
    } catch {
        return false;
    }
}

/**
 * Loads private keys from a specified file.
 * @param {string} filePath - The path to the file containing private keys.
 * @param {function} addLog - Callback function to add log messages.
 * @returns {string[]} - An array of valid private keys.
 * @throws {Error} If the file is not found or no valid private keys are found.
 */
function loadPrivateKeys(filePath = 'pvkey.txt', addLog) {
    if (!fs.existsSync(filePath)) {
        addLog(`✖ Error: pvkey.txt file not found`);
        fs.writeFileSync(filePath, '# Add private keys here, one per line\n# Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n');
        throw new Error('pvkey.txt file not found');
    }
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const validKeys = [];
    lines.forEach((line, idx) => {
        let key = line.trim();
        if (key && !key.startsWith('#')) {
            if (isValidPrivateKey(key)) {
                if (!key.startsWith('0x')) key = '0x' + key;
                validKeys.push(key);
            } else {
                addLog(`⚠ Warning: Line ${idx + 1} is invalid, skipped: ${key}`);
            }
        }
    });
    if (validKeys.length === 0) {
        addLog(`✖ Error: No valid private keys found`);
        throw new Error('No valid private keys found');
    }
    return validKeys;
}

/**
 * Shuffles an array of private keys randomly.
 * @param {string[]} keys - The array of private keys to shuffle.
 * @returns {string[]} - The shuffled array of private keys.
 */
function shuffleWallets(keys) {
    return keys.map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
}

/**
 * Generates a random integer within a specified range (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} - A random integer.
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Connects to the Web3 provider and checks the connection.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @returns {Web3} - The Web3 instance.
 * @throws {Error} If the connection fails.
 */
async function connectWeb3(addLog, updatePanel) {
    try {
        const web3 = new Web3(SOMNIA_TESTNET_RPC_URL);
        const isConnected = await web3.eth.net.isListening();
        if (!isConnected) {
            addLog(`✖ Error: Failed to connect to RPC`);
            updatePanel(`✖ Error: Failed to connect to RPC`);
            throw new Error('Failed to connect to RPC');
        }
        const chainId = await web3.eth.getChainId();
        addLog(`✔ Success: Connected to Somnia Testnet │ Chain ID: ${chainId}`);
        updatePanel(`✔ Connected to Somnia Testnet │ Chain ID: ${chainId}`);
        return web3;
    } catch (e) {
        addLog(`✖ Error: Web3 connection failed: ${e.message}`);
        updatePanel(`✖ Error: Web3 connection failed: ${e.message}`);
        throw e;
    }
}

/**
 * Generates the bytecode for minting PongPing tokens.
 * Updated to use the correct function selector.
 * @param {string} address - The recipient address for the mint.
 * @returns {string} - The bytecode string.
 */
function bytecodeMintPongPing(address) {
    const addressClean = address.replace("0x", "").toLowerCase();
    // Using 0x1249c58b as the function selector based on user's transaction data
    return `0x1249c58b000000000000000000000000${addressClean}00000000000000000000000000000000000000000000003635c9adc5dea00000`;
}

/**
 * Mints PongPing tokens for a given private key.
 * Gas estimation has been removed.
 * @param {Web3} web3 - The Web3 instance.
 * @param {string} privateKey - The private key of the wallet to mint from.
 * @param {number} walletIndex - The index of the current wallet being processed.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @returns {Promise<boolean>} - True if minting was successful, false otherwise.
 */
async function mintPongPing(web3, privateKey, walletIndex, addLog, updatePanel) {
    try {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const address = account.address;
        // Updated CONTRACT_ADDRESS to the $PING contract address provided in the snippet
        const CONTRACT_ADDRESS = "0x33E7fAB0a8a5da1A923180989bD617c9c2D1C493"; // $PING contract

        // Check STT balance
        const balance = await web3.eth.getBalance(address);
        addLog(`Info: Wallet ${walletIndex} │ STT balance: ${web3.utils.fromWei(balance, 'ether')} STT`);
        if (Number(balance) < Number(web3.utils.toWei('0.001', 'ether'))) {
            addLog(`⚠ Warning: Wallet ${walletIndex} │ Insufficient STT: ${address}`);
            updatePanel(`⚠ Wallet ${walletIndex}: Insufficient STT`);
            return false;
        }

        // Build transaction
        const nonce = await web3.eth.getTransactionCount(address);
        const gasPrice = await web3.eth.getGasPrice();
        let tx = {
            to: CONTRACT_ADDRESS,
            value: '0x0',
            data: bytecodeMintPongPing(address),
            nonce: nonce,
            gas: 2473724, // Fixed gas limit based on user provided data (0x25befc)
            gasPrice: gasPrice,
            chainId: await web3.eth.getChainId()
        };

        // Sign and send the transaction
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        addLog(`✔ Success: Wallet ${walletIndex} │ Tx sent: ${SOMNIA_TESTNET_EXPLORER_URL}/tx/${sentTx.transactionHash}`);
        updatePanel(`✔ Wallet ${walletIndex}: Tx sent`);

        // Wait for transaction confirmation
        if (sentTx.status) {
            addLog(`✔ Success: Wallet ${walletIndex} │ Minted 1000 $PING successfully`); // Updated token name
            updatePanel(`✔ Wallet ${walletIndex}: Minted 1000 $PING successfully`); // Updated token name
            return true;
        } else {
            addLog(`✖ Error: Wallet ${walletIndex} │ Mint failed`);
            updatePanel(`✖ Wallet ${walletIndex}: Mint failed`);
            return false;
        }
    } catch (e) {
        addLog(`✖ Error: Wallet ${walletIndex} │ Processing failed: ${e.message}`);
        updatePanel(`✖ Wallet ${walletIndex}: Processing failed: ${e.message}`);
        return false;
    }
}

/**
 * Main function to run the PongPing minting process.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} closeUI - Callback function to close the UI (if applicable).
 * @param {function} requestInput - Callback function to request user input (if applicable).
 */
module.exports = async function runMintPing(updatePanel, addLog, closeUI, requestInput) { // Updated function name
    try {
        updatePanel('\n START MINTING $PING \n'); // Updated token name
        addLog('--- Start Minting $PING ---'); // Updated token name

        let privateKeys = loadPrivateKeys('pvkey.txt', addLog);
        if (SHUFFLE_WALLETS) privateKeys = shuffleWallets(privateKeys);

        addLog(`Info: Found ${privateKeys.length} wallets`);
        updatePanel(`\n Found ${privateKeys.length} wallets \n`);

        if (privateKeys.length === 0) {
            addLog(`✖ Error: No wallets to mint`);
            updatePanel(`✖ Error: No wallets to mint`);
            return;
        }

        const web3 = await connectWeb3(addLog, updatePanel);

        let successfulMints = 0;
        for (let i = 0; i < privateKeys.length; i++) {
            updatePanel(`\n --- Processing wallet: ${i + 1}/${privateKeys.length} --- \n`);
            addLog(`--- Processing wallet: ${i + 1}/${privateKeys.length} ---`);

            const privateKey = privateKeys[i];
            const minted = await mintPongPing(web3, privateKey, i + 1, addLog, updatePanel);
            if (minted) successfulMints++;

            if (i < privateKeys.length - 1) {
                const delay = getRandomInt(MINT_PONGPING_SLEEP_RANGE[0], MINT_PONGPING_SLEEP_RANGE[1]);
                addLog(`Info: Sleeping for ${delay} seconds`);
                updatePanel(`Sleeping for ${delay} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        }

        updatePanel(`\n COMPLETED: ${successfulMints}/${privateKeys.length} wallets successful \n`);
        addLog(`--- COMPLETED: ${successfulMints}/${privateKeys.length} wallets successful ---`);
    } catch (err) {
        addLog(`✖ Error: ${err.message}`);
        updatePanel(`✖ Error: ${err.message}`);
    }
};
