const Web3 = require('web3'); // Use direct require for compatibility
const fs = require('fs');
const path = require('path');

// Config
const NETWORK_URL = 'https://dream-rpc.somnia.network';
const CHAIN_ID = 50312;
const EXPLORER_URL = 'https://shannon-explorer.somnia.network/tx/'; // Changed to append tx hash directly
const CONTRACT_ADDRESS = '0x65296738D4E5edB1515e40287B6FDf8320E6eE04'; // sUSDT contract
const MINT_AMOUNT = 1000; // Mint 1000 sUSDT
const MINT_DATA = '0x1249c58b'; // Bytecode for mint function

/**
 * Helper to safely call logging functions, falling back to console.log if not a function.
 * Removes color codes for console.log output.
 * @param {function|undefined} logFunc - The logging function (e.g., addLog).
 * @param {string} message - The message to log.
 */
function safeLog(logFunc, message) {
    if (typeof logFunc === 'function') {
        logFunc(message);
    } else {
        console.log(message.replace(/\{.*?}/g, '')); // Remove color codes for console.log
    }
}

/**
 * Helper to safely call panel update functions, falling back to console.log if not a function.
 * Removes color codes for console.log output.
 * @param {function|undefined} updateFunc - The panel update function (e.g., updatePanel).
 * @param {string} message - The message to update the panel with.
 */
function safeUpdatePanel(updateFunc, message) {
    if (typeof updateFunc === 'function') {
        updateFunc(message);
    } else {
        console.log(message.replace(/\{.*?}/g, '')); // Remove color codes for console.log
    }
}

/**
 * Validates if a given string is a valid Ethereum private key.
 * Handles optional '0x' prefix and ensures correct length and hexadecimal format.
 * @param {string} key - The private key string to validate.
 * @returns {string|boolean} - The validated private key with '0x' prefix if valid, otherwise false.
 */
function isValidPrivateKey(key) {
    key = key.trim();
    if (!key.startsWith('0x')) key = '0x' + key;
    try {
        return /^0x[a-fA-F0-9]{64}$/.test(key);
    } catch {
        return false;
    }
}

/**
 * Loads private keys from 'pvkey.txt' file.
 * Creates the file with a template if it doesn't exist.
 * @param {function} log - Callback function to add log messages.
 * @returns {Array<[number, string]>} - An array of [line number, private key] tuples.
 * @throws {Error} If the file is not found or no valid keys are present.
 */
function loadPrivateKeys(log) {
    const filePath = path.join(__dirname, 'pvkey.txt');
    safeLog(log, `{cyan-fg}ℹ Checking pvkey.txt at: ${filePath}{/cyan-fg}`);

    if (!fs.existsSync(filePath)) {
        safeLog(log, '{red-fg}✖ Error: pvkey.txt file not found{/red-fg}');
        fs.writeFileSync(filePath, '# Add private keys here, one per line\n# Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n');
        throw new Error('pvkey.txt file not found');
    }

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        safeLog(log, `{cyan-fg}ℹ pvkey.txt content:\n${content.split('\n').map(line => line.substring(0, 10) + (line.length > 10 ? '...' : '')).join('\n')}{/cyan-fg}`);
    } catch (e) {
        safeLog(log, `{red-fg}✖ Error: Failed to read pvkey.txt: ${e.message}{/red-fg}`);
        throw new Error('Failed to read pvkey.txt');
    }

    const lines = content.split('\n');
    const validKeys = [];
    lines.forEach((line, idx) => {
        let key = line.trim();
        if (key && !key.startsWith('#')) {
            if (isValidPrivateKey(key)) {
                if (!key.startsWith('0x')) key = '0x' + key;
                validKeys.push([idx + 1, key]); // Store line number and key
                safeLog(log, `{green-fg}✔ Valid key found at line ${idx + 1}: ${key.substring(0, 6)}...{/green-fg}`);
            } else {
                safeLog(log, `{yellow-fg}⚠ Warning: Line ${idx + 1} is invalid, skipped: ${key.substring(0, 10)}...{/yellow-fg}`);
            }
        }
    });

    if (validKeys.length === 0) {
        safeLog(log, '{red-fg}✖ Error: No valid private keys found in pvkey.txt{/red-fg}');
        throw new Error('No valid private keys found');
    }
    safeLog(log, `{cyan-fg}ℹ Loaded ${validKeys.length} valid private keys{/cyan-fg}`);
    return validKeys;
}

/**
 * Connects to the Web3 provider and checks the connection.
 * @param {function} log - Callback function to add log messages.
 * @param {function} panelUpdate - Callback function to update the UI panel.
 * @returns {Web3} - The Web3 instance.
 * @throws {Error} If the connection fails.
 */
async function connectWeb3(log, panelUpdate) {
    try {
        safeLog(log, '{cyan-fg}ℹ Initializing Web3 connection...{/cyan-fg}');
        const web3 = new Web3(NETWORK_URL);
        safeLog(log, '{cyan-fg}ℹ Checking network connection...{/cyan-fg}');
        const isConnected = await web3.eth.net.isListening();
        if (!isConnected) {
            safeLog(log, '{red-fg}✖ Error: Failed to connect to RPC{/red-fg}');
            safeUpdatePanel(panelUpdate, '{red-fg}✖ Error: Failed to connect to RPC{/red-fg}');
            throw new Error('Failed to connect to RPC');
        }
        const chainId = (await web3.eth.getChainId()).toString();
        safeLog(log, `{green-fg}✔ Success: Connected to Somnia Testnet │ Chain ID: ${chainId}{/green-fg}`);
        safeUpdatePanel(panelUpdate, `{green-fg}✔ Connected to Somnia Testnet │ Chain ID: ${chainId}{/green-fg}`);
        return web3;
    } catch (e) {
        safeLog(log, `{red-fg}✖ Error: Web3 connection failed: ${e.message}{/red-fg}`);
        safeUpdatePanel(panelUpdate, `{red-fg}✖ Error: Web3 connection failed: ${e.message}{/red-fg}`);
        throw e;
    }
}

// Check if wallet has already minted sUSDT
async function hasMintedSusdt(web3, address, log) {
    // Simple ABI to call balanceOf (ERC-20 standard)
    const susdtAbi = [
        {
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        }
    ];

    try {
        const contract = new web3.eth.Contract(susdtAbi, CONTRACT_ADDRESS);
        const balance = await contract.methods.balanceOf(address).call();
        return BigInt(balance) > 0; // If balance > 0, wallet has already minted
    } catch (e) {
        safeLog(log, `⚠ Warning: Failed to check sUSDT balance: ${e.message}`);
        return false; // Default to not minted if check fails
    }
}

// Function to mint sUSDT
async function mintSusdt(web3, privateKey, walletIndex, log, panelUpdate) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const senderAddress = account.address;

    // Check if wallet has already minted
    if (await hasMintedSusdt(web3, senderAddress, log)) {
        safeLog(log, `⚠ Warning: This wallet has already minted sUSDT! Skipping this request.`);
        safeUpdatePanel(panelUpdate, `⚠ Wallet ${walletIndex}: Already minted sUSDT`);
        return false;
    }

    try {
        // Check STT balance
        safeLog(log, `Checking balance...`);
        safeUpdatePanel(panelUpdate, `Checking balance for wallet ${walletIndex}...`);

        const balance = web3.utils.fromWei(await web3.eth.getBalance(senderAddress), 'ether');
        if (parseFloat(balance) < 0.001) { // Assume at least 0.001 STT needed for gas
            safeLog(log, `✖ Error: Insufficient balance: ${balance} STT < 0.001 STT`);
            safeUpdatePanel(panelUpdate, `✖ Wallet ${walletIndex}: Insufficient balance: ${balance} STT`);
            return false;
        }

        // Prepare transaction
        safeLog(log, `Preparing transaction...`);
        safeUpdatePanel(panelUpdate, `Preparing transaction for wallet ${walletIndex}...`);

        const nonce = await web3.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3.eth.getGasPrice();
        const adjustedGasPrice = Math.floor(parseInt(gasPrice) * (1 + Math.random() * 0.07)); // Increase gas price by 0-7%

        const txParams = {
            nonce: nonce,
            to: CONTRACT_ADDRESS,
            value: '0x0', // No STT sent, just minting
            data: MINT_DATA,
            chainId: CHAIN_ID,
            gas: 2000000, // Fixed gas since estimateGas might not work
            gasPrice: adjustedGasPrice
        };

        // Send transaction
        safeLog(log, `Sending transaction...`);
        safeUpdatePanel(panelUpdate, `Sending transaction for wallet ${walletIndex}...`);

        const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
        const txReceipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        const txLink = `${EXPLORER_URL}${txReceipt.transactionHash}`;

        if (txReceipt.status) {
            safeLog(log, `✔ Success: Successfully minted ${MINT_AMOUNT} sUSDT! │ Tx: ${txLink}`);
            safeLog(log, `  Address: ${senderAddress}`);
            safeLog(log, `  Amount: ${MINT_AMOUNT} sUSDT`);
            safeLog(log, `  Gas: ${txReceipt.gasUsed}`);
            safeLog(log, `  Block: ${txReceipt.blockNumber}`);
            safeLog(log, `  Balance: ${balance} STT`);

            safeUpdatePanel(panelUpdate, `✔ Wallet ${walletIndex}: Successfully minted ${MINT_AMOUNT} sUSDT!`);
            return true;
        } else {
            safeLog(log, `✖ Error: Mint failed │ Tx: ${txLink}`);
            safeUpdatePanel(panelUpdate, `✖ Wallet ${walletIndex}: Mint failed`);
            return false;
        }
    } catch (e) {
        safeLog(log, `✖ Error: Failed: ${e.message}`);
        safeUpdatePanel(panelUpdate, `✖ Wallet ${walletIndex}: Failed: ${e.message}`);
        return false;
    }
}

// Main function
module.exports = async function runMintSusdt(updatePanel, addLog, closeUI, requestInput) {
    // Ensure addLog and updatePanel are callable functions
    const log = typeof addLog === 'function' ? addLog : (msg) => console.log(msg.replace(/\{.*?}/g, ''));
    const panelUpdate = typeof updatePanel === 'function' ? updatePanel : (msg) => console.log(msg.replace(/\{.*?}/g, ''));

    try {
        panelUpdate('{cyan-fg}\n MINT sUSDT - SOMNIA TESTNET \n{/cyan-fg}');
        log('--- Start Minting sUSDT ---');

        let privateKeys = loadPrivateKeys(log); // Pass 'log' to loadPrivateKeys
        log(`Info: Found ${privateKeys.length} wallets`);
        panelUpdate(`\n Found ${privateKeys.length} wallets \n`);

        if (privateKeys.length === 0) {
            log(`✖ Error: No wallets to mint`);
            panelUpdate(`\n ✖ Error: No wallets to mint \n`);
            return;
        }

        const web3 = await connectWeb3(log, panelUpdate); // Pass 'log' and 'panelUpdate' to connectWeb3

        // Shuffle wallets for randomization
        privateKeys.sort(() => Math.random() - 0.5);

        let successfulMints = 0;
        for (let i = 0; i < privateKeys.length; i++) {
            const [profileNum, privateKey] = privateKeys[i];

            panelUpdate(`\n PROCESSING WALLET ${profileNum} (${i + 1}/${privateKeys.length}) \n`);
            log(`--- Processing wallet ${profileNum} (${i + 1}/${privateKeys.length}) ---`);

            if (await mintSusdt(web3, privateKey, profileNum, log, panelUpdate)) { // Pass 'log' and 'panelUpdate' to mintSusdt
                successfulMints++;
            }

            if (i < privateKeys.length - 1) {
                const delay = 10 + Math.random() * 20; // Random 10-30 seconds
                log(`Info: Pausing ${delay.toFixed(2)} seconds`);
                panelUpdate(`\n Pausing ${delay.toFixed(2)} seconds... \n`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        }

        panelUpdate(`\n COMPLETED: ${successfulMints}/${privateKeys.length} TRANSACTIONS SUCCESSFUL \n`);
        log(`--- COMPLETED: ${successfulMints}/${privateKeys.length} TRANSACTIONS SUCCESSFUL ---`);
    } catch (err) {
        log(`✖ Error: ${err.message}`);
        panelUpdate(`\n ✖ Error: ${err.message} \n`);
    }
};
