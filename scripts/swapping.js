const Web3 = require('web3'); // Use direct require for compatibility
const fs = require('fs');
const path = require('path');

// Config
const SOMNIA_TESTNET_RPC_URL = 'https://dream-rpc.somnia.network';
const SOMNIA_TESTNET_EXPLORER_URL = 'https://shannon-explorer.somnia.network';
const SHUFFLE_WALLETS = true;
const SWAP_PONGPING_SLEEP_RANGE = [30, 90]; // Increased seconds for better network stability

// Max uint256 value for approving infinite amount (kept for reference, but not used for approval amount)
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

const TOKEN_ABI = [
    {
        constant: false,
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
];

const SWAP_ROUTER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: 'tokenIn', type: 'address' },
                    { name: 'tokenOut', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'recipient', type: 'address' },
                    { name: 'amountIn', type: 'uint256' },
                    { name: 'amountOutMinimum', type: 'uint256' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' }
                ],
                name: 'params',
                type: 'tuple'
            }
        ],
        name: 'exactInputSingle',
        outputs: [{ name: 'amountOut', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

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
    if (!key || typeof key !== 'string') return false;
    key = key.trim();
    if (!key) return false;
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    const isValid = /^[a-fA-F0-9]{64}$/.test(cleanKey);
    return isValid ? (key.startsWith('0x') ? key : '0x' + cleanKey) : false;
}

/**
 * Loads private keys from 'pvkey.txt' file.
 * Creates the file with a template if it doesn't exist.
 * @param {function} log - Callback function to add log messages.
 * @returns {string[]} - An array of validated private keys.
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
        const key = line.trim();
        if (!key || key.startsWith('#')) {
            if (key) safeLog(log, `{cyan-fg}ℹ Skipping comment/empty line ${idx + 1}: ${key.substring(0, 10)}...{/cyan-fg}`);
            return;
        }

        const validatedKey = isValidPrivateKey(key);
        if (validatedKey) {
            validKeys.push(validatedKey);
            safeLog(log, `{green-fg}✔ Valid key found at line ${idx + 1}: ${validatedKey.substring(0, 6)}...{/green-fg}`);
        } else {
            safeLog(log, `{yellow-fg}⚠ Invalid key at line ${idx + 1}: length=${key.length}, content=${key.substring(0, 10)}...{/yellow-fg}`);
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
 * Shuffles an array of private keys randomly.
 * @param {string[]} keys - The array of private keys to shuffle.
 * @returns {string[]} - The shuffled array of private keys.
 */
function shuffleWallets(keys) {
    return keys
        .map(value => ({ value, sort: Math.random() }))
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
 * @param {function} log - Callback function to add log messages.
 * @param {function} panelUpdate - Callback function to update the UI panel.
 * @returns {Web3} - The Web3 instance.
 * @throws {Error} If the connection fails.
 */
async function connectWeb3(log, panelUpdate) {
    try {
        safeLog(log, '{cyan-fg}ℹ Initializing Web3 connection...{/cyan-fg}');
        const web3 = new Web3(SOMNIA_TESTNET_RPC_URL);
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

/**
 * Sends a signed transaction and waits for its receipt with retries.
 * @param {Web3} web3 - The Web3 instance.
 * @param {object} txParams - The transaction parameters.
 * @param {string} privateKey - The private key for signing.
 * @param {number} walletIndex - The index of the current wallet.
 * @param {function} log - Logging function.
 * @param {function} panelUpdate - Panel update function.
 * @param {object} txStats - Transaction statistics object.
 * @param {string} txType - Type of transaction (e.g., 'Approval', 'Swap').
 * @returns {Promise<object|null>} - The transaction receipt if successful, otherwise null.
 */
async function sendAndConfirmTransaction(web3, txParams, privateKey, walletIndex, log, panelUpdate, txStats, txType) {
    const maxRetries = 5;
    let retryCount = 0;
    let receipt = null;
    const startTime = Date.now(); // Record start time for accurate tx time calculation

    while (retryCount < maxRetries) {
        try {
            // Fetch the latest nonce right before sending
            txParams.nonce = await web3.eth.getTransactionCount(txParams.from, 'pending'); // Use 'pending' for the latest nonce

            safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Sending ${txType} Transaction (Attempt ${retryCount + 1}/${maxRetries})...{/cyan-fg}`);
            const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
            receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            if (receipt.status) {
                safeLog(log, `{green-fg}✔ Success: Wallet ${walletIndex} │ ${txType} Tx: ${SOMNIA_TESTNET_EXPLORER_URL}/tx/${receipt.transactionHash}{/green-fg}`);
                txStats.pending--; // Decrement pending on success
                txStats.success++;
                txStats.times.push(Date.now() - startTime); // Use actual time elapsed
                return receipt;
            } else {
                safeLog(log, `{red-fg}✖ Error: Wallet ${walletIndex} │ ${txType} failed (reverted by EVM). Tx Hash: ${receipt.transactionHash}{/red-fg}`);
                txStats.pending--; // Decrement pending on revert
                txStats.failed++;
                return null; // If status is false, it means the transaction reverted. No need to retry.
            }
        } catch (e) {
            safeLog(log, `{yellow-fg}⚠ Wallet ${walletIndex} │ ${txType} transaction error (Attempt ${retryCount + 1}): ${e.message}{/yellow-fg}`);

            // Check for specific errors that might warrant a retry
            const errorMessage = e.message.toLowerCase();
            if (errorMessage.includes('nonce too low') || errorMessage.includes('transaction underpriced') || errorMessage.includes('replacement transaction underpriced') || errorMessage.includes('transaction already imported') || errorMessage.includes('transaction with the same hash was already imported')) {
                // These errors often indicate a temporary network or nonce issue, so retry
                retryCount++;
                const delay = getRandomInt(5, 10) * (2 ** retryCount); // Exponential backoff with random jitter
                safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Retrying ${txType} in ${delay} seconds...{/cyan-fg}`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            } else if (errorMessage.includes('transaction was not mined within')) {
                // "Transaction not mined" error, retry
                retryCount++;
                const delay = getRandomInt(10, 20) * (2 ** retryCount); // Longer delay for mining issues
                safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Retrying ${txType} due to timeout in ${delay} seconds...{/cyan-fg}`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
            else {
                // For other errors, consider it a failure and break the loop
                safeLog(log, `{red-fg}✖ Error: Wallet ${walletIndex} │ ${txType} failed permanently after error: ${e.message}{/red-fg}`);
                txStats.pending--; // Decrement pending on permanent failure
                txStats.failed++;
                return null;
            }
        }
    }
    safeLog(log, `{red-fg}✖ Error: Wallet ${walletIndex} │ ${txType} failed after ${maxRetries} retries.{/red-fg}`);
    txStats.pending--; // Decrement pending if all retries exhausted
    txStats.failed++;
    return null;
}


/**
 * Approves a token amount for a spender.
 * This function now approves a specific amount (1000 tokens) for the spender.
 * @param {Web3} web3 - The Web3 instance.
 * @param {string} privateKey - The private key of the wallet performing the approval.
 * @param {string} tokenAddress - The address of the token contract.
 * @param {string} spenderAddress - The address of the spender to approve.
 * @param {string} ownerAddress - The address of the token owner.
 * @param {number} amountToApprove - The specific amount of tokens to approve (e.g., 1000).
 * @param {number} walletIndex - The index of the current wallet.
 * @param {function} log - Callback function to add log messages.
 * @param {function} panelUpdate - Callback function to update the UI panel.
 * @param {object} txStats - Object to track transaction statistics.
 * @returns {Promise<string|null>} - The transaction hash if successful, otherwise null.
 */
async function approveToken(web3, privateKey, tokenAddress, spenderAddress, ownerAddress, amountToApprove, walletIndex, log, panelUpdate, txStats) {
    try {
        // Check STT balance first
        const balance = web3.utils.fromWei(await web3.eth.getBalance(ownerAddress), 'ether');
        if (parseFloat(balance) < 0.001) { // Assuming 0.001 STT is a safe minimum for gas
            safeLog(log, `{red-fg}✖ Error: Wallet ${walletIndex} │ Insufficient STT balance for approval: ${balance} STT < 0.001 STT{/red-fg}`);
            safeUpdatePanel(panelUpdate, `{red-fg}✖ Wallet ${walletIndex}: Insufficient STT for approval (${balance} STT){/red-fg}`);
            txStats.failed++;
            return null;
        }

        const tokenContract = new web3.eth.Contract(TOKEN_ABI, tokenAddress);
        const decimals = await tokenContract.methods.decimals().call();
        const amountWeiToApprove = BigInt(Math.floor(amountToApprove * (10 ** decimals)));

        const currentAllowance = BigInt(await tokenContract.methods.allowance(ownerAddress, spenderAddress).call());
        const tokenBalance = BigInt(await tokenContract.methods.balanceOf(ownerAddress).call());

        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Current Allowance: ${currentAllowance.toString()} (wei) for spender ${spenderAddress}{/cyan-fg}`);
        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Token Balance ($PONG): ${web3.utils.fromWei(tokenBalance.toString(), 'ether')} $PONG{/cyan-fg}`);
        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Amount to Approve: ${amountToApprove} $PONG (${amountWeiToApprove.toString()} wei){/cyan-fg}`);


        if (tokenBalance < amountWeiToApprove) {
            safeLog(log, `{red-fg}✖ Error: Wallet ${walletIndex} │ Insufficient $PONG balance to approve. Has ${web3.utils.fromWei(tokenBalance.toString(), 'ether')} $PONG, needs ${amountToApprove} $PONG.{/red-fg}`);
            safeUpdatePanel(panelUpdate, `{red-fg}✖ Wallet ${walletIndex}: Insufficient $PONG balance for approval.{/red-fg}`);
            txStats.failed++;
            return null;
        }

        if (currentAllowance >= amountWeiToApprove) { // Check if allowance is already sufficient for the requested amount
            safeLog(log, `{green-fg}✔ Info: Wallet ${walletIndex} │ Allowance already sufficient for ${amountToApprove} $PONG. Skipping approval.{/green-fg}`);
            safeUpdatePanel(panelUpdate, `{green-fg}✔ Wallet ${walletIndex}: Allowance sufficient for ${amountToApprove} $PONG.{/green-fg}`);
            return "ALREADY_APPROVED"; // Indicate that no new transaction was sent
        }

        const txParams = {
            from: ownerAddress,
            to: tokenAddress,
            gas: 3000000, // Fixed gas limit for approval
            gasPrice: await web3.eth.getGasPrice(),
            data: tokenContract.methods.approve(spenderAddress, amountWeiToApprove.toString()).encodeABI(),
            // nonce will be fetched inside sendAndConfirmTransaction
        };

        txStats.pending++; // Increment pending before sending
        const receipt = await sendAndConfirmTransaction(web3, txParams, privateKey, walletIndex, log, panelUpdate, txStats, 'Approval');

        if (receipt) {
            return receipt.transactionHash;
        } else {
            return null;
        }
    } catch (e) {
        // Error already logged and txStats updated within sendAndConfirmTransaction or earlier checks
        return null;
    }
}

/**
 * Swaps tokens using the Uniswap V3 router.
 * Gas estimation is NOT performed; a fixed gas limit is used.
 * @param {Web3} web3 - The Web3 instance.
 * @param {string} privateKey - The private key of the wallet performing the swap.
 * @param {string} tokenIn - The address of the input token.
 * @param {string} tokenOut - The address of the output token.
 * @param {number} amountIn - The amount of input tokens to swap (in human-readable units).
 * @param {string} recipient - The recipient address for the swapped tokens.
 * @param {number} walletIndex - The index of the current wallet.
 * @param {function} log - Callback function to add log messages.
 * @param {function} panelUpdate - Callback function to update the UI panel.
 * @param {object} txStats - Object to track transaction statistics.
 * @returns {Promise<string|null>} - The transaction hash if successful, otherwise null.
 */
async function swapToken(web3, privateKey, tokenIn, tokenOut, amountIn, recipient, walletIndex, log, panelUpdate, txStats) {
    try {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const swapRouterAddress = '0x6aac14f090a35eea150705f72d90e4cdc4a49b2c';
        const fee = 500;
        // Set slippage tolerance to 5%
        const slippageTolerance = 0.95; 
        
        // Fetch decimals for tokenIn
        const tokenInContract = new web3.eth.Contract(TOKEN_ABI, tokenIn);
        const tokenInDecimals = await tokenInContract.methods.decimals().call();
        
        const amountInWei = BigInt(Math.floor(amountIn * (10 ** tokenInDecimals))); 
        const amountOutMinimum = BigInt(Math.floor(amountIn * slippageTolerance * (10 ** tokenInDecimals))); 


        const tokenOutContract = new web3.eth.Contract(TOKEN_ABI, tokenOut);

        const tokenInBalance = BigInt(await tokenInContract.methods.balanceOf(account.address).call());
        const tokenOutBalance = BigInt(await tokenOutContract.methods.balanceOf(account.address).call());

        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Pre-Swap $PONG Balance: ${web3.utils.fromWei(tokenInBalance.toString(), 'ether')} $PONG{/cyan-fg}`);
        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Pre-Swap $PING Balance: ${web3.utils.fromWei(tokenOutBalance.toString(), 'ether')} $PING{/cyan-fg}`);
        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Amount to Swap (in $PONG): ${amountIn} (${amountInWei.toString()} wei){/cyan-fg}`);
        safeLog(log, `{cyan-fg}ℹ Wallet ${walletIndex} │ Minimum Amount Out (in $PING): ${web3.utils.fromWei(amountOutMinimum.toString(), 'ether')} $PING (${amountOutMinimum.toString()} wei) (Slippage: ${(1 - slippageTolerance) * 100}%){/cyan-fg}`);


        if (tokenInBalance < amountInWei) {
            safeLog(log, `{red-fg}✖ Error: Wallet ${walletIndex} │ Insufficient $PONG balance for swap. Has ${web3.utils.fromWei(tokenInBalance.toString(), 'ether')} $PONG, needs ${amountIn} $PONG.{/red-fg}`);
            safeUpdatePanel(panelUpdate, `{red-fg}✖ Wallet ${walletIndex}: Insufficient $PONG for swap.{/red-fg}`);
            txStats.failed++;
            return null;
        }

        const swapRouter = new web3.eth.Contract(SWAP_ROUTER_ABI, swapRouterAddress);

        const txParams = {
            from: account.address,
            to: swapRouterAddress,
            gas: 3000000, // Fixed gas limit
            gasPrice: await web3.eth.getGasPrice(),
            data: swapRouter.methods.exactInputSingle([
                tokenIn,
                tokenOut,
                fee,
                recipient,
                amountInWei.toString(),
                amountOutMinimum.toString(),
                0
            ]).encodeABI(),
            chainId: await web3.eth.getChainId()
            // nonce will be fetched inside sendAndConfirmTransaction
        };

        txStats.pending++; // Increment pending before sending
        const receipt = await sendAndConfirmTransaction(web3, txParams, privateKey, walletIndex, log, panelUpdate, txStats, 'Swap');

        if (receipt) {
            return receipt.transactionHash;
        } else {
            return null;
        }
    } catch (e) {
        // Error already logged and txStats updated within sendAndConfirmTransaction or earlier checks
        return null;
    }
}

/**
 * Main function to run the token swapping process.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @param {function} closeUI - Callback function to close the UI (if applicable).
 * @param {function} requestInput - Callback function to request user input (if applicable).
 */
module.exports = async function runSwapping(addLog, updatePanel, closeUI, requestInput) {
    // Ensure addLog and updatePanel are callable functions
    const log = typeof addLog === 'function' ? addLog : (msg) => console.log(msg.replace(/\{.*?}/g, ''));
    const panelUpdate = typeof updatePanel === 'function' ? updatePanel : (msg) => console.log(msg.replace(/\{.*?}/g, ''));

    try {
        panelUpdate('{cyan-fg}\n START SWAPPING $PONG -> $PING \n{/cyan-fg}');
        log('{cyan-fg}--- Start Swapping $PONG -> $PING ---{/cyan-fg}');

        let privateKeys = loadPrivateKeys(log); // Pass 'log' to loadPrivateKeys
        if (SHUFFLE_WALLETS) privateKeys = shuffleWallets(privateKeys);

        log(`{cyan-fg}ℹ Info: Found ${privateKeys.length} wallets{/cyan-fg}`);
        panelUpdate(`{cyan-fg}\n Found ${privateKeys.length} wallets \n{/cyan-fg}`);

        if (privateKeys.length === 0) {
            log('{red-fg}✖ Error: No wallets to swap{/red-fg}');
            panelUpdate('{red-fg}\n ✖ Error: No wallets to swap \n{/red-fg}');
            return;
        }

        const amount = await requestInput('Amount of $PONG to swap (e.g., 100)', 'number', 100);
        panelUpdate(`{cyan-fg}\n Amount to swap: ${amount} $PONG \n{/cyan-fg}`);
        log(`{cyan-fg}Amount to swap: ${amount} $PONG{/cyan-fg}`);

        const swapTimes = await requestInput('Number of swaps per wallet (default 1)', 'number', 1);
        panelUpdate(`{cyan-fg}\n Swaps per wallet: ${swapTimes} \n{/cyan-fg}`);
        log(`{cyan-fg}Swaps per wallet: ${swapTimes}{/cyan-fg}`);

        // Pass the new 'log' and 'panelUpdate' functions to connectWeb3
        const web3 = await connectWeb3(log, panelUpdate);

        const txStats = {
            success: 0,
            failed: 0,
            pending: 0,
            times: []
        };

        let successfulSwaps = 0;
        for (let i = 0; i < privateKeys.length; i++) {
            panelUpdate(`{cyan-fg}\n PROCESSING WALLET ${i + 1}/${privateKeys.length} \n{/cyan-fg}`);
            log(`{cyan-fg}--- Processing Wallet ${i + 1}/${privateKeys.length} ---{/cyan-fg}`);

            const privateKey = privateKeys[i];
            const tokenIn = '0x9beaA0016c22B646Ac311Ab171270B0ECf23098F'; // $PONG
            const tokenOut = '0x33E7fAB0a8a5da1A923180989bD617c9c2D1C493'; // $PING
            const spenderAddress = '0x6aac14f090a35eea150705f72d90e4cdc4a49b2c'; // Uniswap V3 Router
            const ownerAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address; // Get owner address

            // Approve the router to spend tokens (now approves 'amount' from user input)
            const approveTx = await approveToken(web3, privateKey, tokenIn, spenderAddress, ownerAddress, amount * swapTimes, i + 1, log, panelUpdate, txStats); // Approve total amount for all swaps
            if (!approveTx || approveTx === "ALREADY_APPROVED") { // Check for "ALREADY_APPROVED" status
                if (approveTx === null) { // Only skip if there was an actual approval failure
                    log(`{yellow-fg}Skipping wallet ${i + 1} due to approval failure{/yellow-fg}`);
                    panelUpdate(`{yellow-fg}\n Skipping wallet ${i + 1} due to approval failure \n{/yellow-fg}`);
                    continue;
                }
            }

            // Perform swaps
            for (let swapIter = 0; swapIter < swapTimes; swapIter++) {
                panelUpdate(`{cyan-fg}\n Wallet ${i + 1}: Performing swap ${swapIter + 1}/${swapTimes} \n{/cyan-fg}`);
                log(`{cyan-fg}Wallet ${i + 1}: Performing swap ${swapIter + 1}/${swapTimes}{/cyan-fg}`);

                const swapTx = await swapToken(web3, privateKey, tokenIn, tokenOut, amount, ownerAddress, i + 1, log, panelUpdate, txStats); // Pass ownerAddress as recipient
                if (swapTx) successfulSwaps++;

                if (swapIter < swapTimes - 1) {
                    const delay = getRandomInt(1, 5);
                    log(`{cyan-fg}ℹ Pausing ${delay} seconds before next swap{/cyan-fg}`);
                    panelUpdate(`{cyan-fg}\n ℹ Pausing ${delay} seconds before next swap... \n{/cyan-fg}`);
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
            }

            if (i < privateKeys.length - 1) {
                const delay = getRandomInt(SWAP_PONGPING_SLEEP_RANGE[0], SWAP_PONGPING_SLEEP_RANGE[1]);
                log(`{cyan-fg}ℹ Waiting ${delay} seconds before processing next wallet{/cyan-fg}`);
                panelUpdate(`{cyan-fg}\n ℹ Waiting ${delay} seconds before processing next wallet... \n{/cyan-fg}`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        }

        panelUpdate(`{green-fg}\n COMPLETED: ${successfulSwaps}/${privateKeys.length * swapTimes} SWAPS SUCCESSFUL \n{/green-fg}`);
        log(`{green-fg}--- COMPLETED: ${successfulSwaps}/${privateKeys.length * swapTimes} SWAPS SUCCESSFUL ---{/green-fg}`);
    } catch (err) {
        log(`{red-fg}✖ Error: ${err.message}{/red-fg}`);
        panelUpdate(`{red-fg}\n ✖ Error: ${err.message} \n{/red-fg}`);
    }
};
