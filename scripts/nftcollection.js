const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

// Config
const NETWORK_URL = 'https://dream-rpc.somnia.network';
const CHAIN_ID = 50312;
const EXPLORER_URL = "https://shannon-explorer.somnia.network";

// The Solidity source code for the NFT contract
const NFT_CONTRACT_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NFTCollection {
    address public owner;
    string public name;
    string public symbol;
    uint256 public maxSupply;
    uint256 public totalSupply;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Mint(address indexed to, uint256 indexed tokenId, string tokenURI);
    event Burn(address indexed from, uint256 indexed tokenId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(_owners[tokenId] != address(0), "Token doesn't exist");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint256 _maxSupply) {
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        maxSupply = _maxSupply;
        totalSupply = 99;
    }

    function mint(address to, uint256 tokenId, string memory tokenURI) public onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(_owners[tokenId] == address(0), "Token already exists");
        require(totalSupply < maxSupply, "Maximum supply reached");

        _owners[tokenId] = to;
        _balances[to]++;
        _tokenURIs[tokenId] = tokenURI;
        totalSupply++;

        emit Transfer(address(0), to, tokenId);
        emit Mint(to, tokenId, tokenURI);
    }

    function burn(uint256 tokenId) public tokenExists(tokenId) {
        address tokenOwner = _owners[tokenId];
        require(msg.sender == tokenOwner || msg.sender == owner, "Not authorized to burn");

        delete _tokenURIs[tokenId];
        delete _owners[tokenId];
        _balances[tokenOwner]--;
        totalSupply--;

        emit Transfer(tokenOwner, address(0), tokenId);
        emit Burn(tokenOwner, tokenId);
    }

    function tokenURI(uint256 tokenId) public view tokenExists(tokenId) returns (string memory) {
        return _tokenURIs[tokenId];
    }

    function ownerOf(uint256 tokenId) public view tokenExists(tokenId) returns (address) {
        return _owners[tokenId];
    }

    function balanceOf(address _owner) public view returns (uint256) {
        require(_owner != address(0), "Zero address has no balance");
        return _balances[_owner];
    }
}
`;

// =================================================================================================
// IMPORTANT: YOU MUST REPLACE THESE PLACEHOLDERS WITH THE ACTUAL COMPILED ABI AND BYTECODE
// You can use an online Solidity compiler or a tool like 'solc-js' to get these values.
// Example: The ABI will be a large JSON array. The bytecode will be a long hex string starting with '0x'.
// =================================================================================================

// NFT Contract ABI and Bytecode
const NFT_ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_symbol",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_maxSupply",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Burn",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "tokenURI",
				"type": "string"
			}
		],
		"name": "Mint",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_owner",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "burn",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "maxSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "tokenURI",
				"type": "string"
			}
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "tokenURI",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
const NFT_BYTECODE = "0x608060405234801561000f575f5ffd5b506040516111bd3803806111bd83398101604081905261002e91610105565b5f80546001600160a01b03191633179055600161004b84826101f6565b50600261005883826101f6565b50600355505060636004556102b0565b634e487b7160e01b5f52604160045260245ffd5b5f82601f83011261008b575f5ffd5b81516001600160401b038111156100a4576100a4610068565b604051601f8201601f19908116603f011681016001600160401b03811182821017156100d2576100d2610068565b6040528181528382016020018510156100e9575f5ffd5b8160208501602083015e5f918101602001919091529392505050565b5f5f5f60608486031215610117575f5ffd5b83516001600160401b0381111561012c575f5ffd5b6101388682870161007c565b602086015190945090506001600160401b03811115610155575f5ffd5b6101618682870161007c565b925050604084015190509250925092565b600181811c9082168061018657607f821691505b6020821081036101a457634e487b7160e01b5f52602260045260245ffd5b50919050565b601f8211156101f157805f5260205f20601f840160051c810160208510156101cf5750805b601f840160051c820191505b818110156101ee575f81556001016101db565b50505b505050565b81516001600160401b0381111561020f5761020f610068565b6102238161021d8454610172565b846101aa565b6020601f821160018114610255575f831561023e5750848201515b5f19600385901b1c1916600184901b1784556101ee565b5f84815260208120601f198516915b828110156102845787850151825560209485019460019092019101610264565b50848210156102a157868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b610f00806102bd5f395ff3fe608060405234801561000f575f5ffd5b50600436106100b9575f3560e01c80638da5cb5b11610072578063c87b56dd11610058578063c87b56dd14610179578063d3fc98641461018c578063d5abeb011461019f575f5ffd5b80638da5cb5b1461015257806395d89b4114610171575f5ffd5b806342966c68116100a257806342966c68146100f25780636352211e1461010757806370a082311461013f575f5ffd5b806306fdde03146100bd57806318160ddd146100db575b5f5ffd5b6100c56101a8565b6040516100d29190610a9c565b60405180910390f35b6100e460045481565b6040519081526020016100d2565b610105610100366004610aef565b610234565b005b61011a610115366004610aef565b61048f565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020016100d2565b6100e461014d366004610b2e565b610548565b5f5461011a9073ffffffffffffffffffffffffffffffffffffffff1681565b6100c56105ee565b6100c5610187366004610aef565b6105fb565b61010561019a366004610b7b565b610726565b6100e460035481565b600180546101b590610c84565b80601f01602080910402602001604051908101604052809291908181526020018280546101e190610c84565b801561022c5780601f106102035761010080835404028352916020019161022c565b820191905f5260205f20905b81548152906001019060200180831161020f57829003601f168201915b505050505081565b5f81815260056020526040902054819073ffffffffffffffffffffffffffffffffffffffff166102c5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f546f6b656e20646f65736e27742065786973740000000000000000000000000060448201526064015b60405180910390fd5b5f8281526005602052604090205473ffffffffffffffffffffffffffffffffffffffff163381148061030d57505f5473ffffffffffffffffffffffffffffffffffffffff1633145b610373576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601660248201527f4e6f7420617574686f72697a656420746f206275726e0000000000000000000060448201526064016102bc565b5f83815260076020526040812061038991610a4a565b5f83815260056020908152604080832080547fffffffffffffffffffffffff000000000000000000000000000000000000000016905573ffffffffffffffffffffffffffffffffffffffff84168352600690915281208054916103eb83610cfc565b909155505060048054905f6103ff83610cfc565b909155505060405183905f9073ffffffffffffffffffffffffffffffffffffffff8416907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908390a4604051839073ffffffffffffffffffffffffffffffffffffffff8316907fcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5905f90a3505050565b5f81815260056020526040812054829073ffffffffffffffffffffffffffffffffffffffff1661051b576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f546f6b656e20646f65736e27742065786973740000000000000000000000000060448201526064016102bc565b5f8381526005602052604090205473ffffffffffffffffffffffffffffffffffffffff1691505b50919050565b5f73ffffffffffffffffffffffffffffffffffffffff82166105c6576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601b60248201527f5a65726f206164647265737320686173206e6f2062616c616e6365000000000060448201526064016102bc565b5073ffffffffffffffffffffffffffffffffffffffff165f9081526006602052604090205490565b600280546101b590610c84565b5f81815260056020526040902054606090829073ffffffffffffffffffffffffffffffffffffffff1661068a576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f546f6b656e20646f65736e27742065786973740000000000000000000000000060448201526064016102bc565b5f83815260076020526040902080546106a290610c84565b80601f01602080910402602001604051908101604052809291908181526020018280546106ce90610c84565b80156107195780601f106106f057610100808354040283529160200191610719565b820191905f5260205f20905b8154815290600101906020018083116106fc57829003601f168201915b5050505050915050919050565b5f5473ffffffffffffffffffffffffffffffffffffffff1633146107a6576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601660248201527f4e6f742074686520636f6e7472616374206f776e65720000000000000000000060448201526064016102bc565b73ffffffffffffffffffffffffffffffffffffffff8316610823576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601b60248201527f43616e6e6f74206d696e7420746f207a65726f2061646472657373000000000060448201526064016102bc565b5f8281526005602052604090205473ffffffffffffffffffffffffffffffffffffffff16156108ae576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f546f6b656e20616c72656164792065786973747300000000000000000000000060448201526064016102bc565b6003546004541061091b576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601660248201527f4d6178696d756d20737570706c7920726561636865640000000000000000000060448201526064016102bc565b5f82815260056020908152604080832080547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff881690811790915583526006909152812080549161098183610d30565b90915550505f82815260076020526040902061099d8282610db3565b5060048054905f6109ad83610d30565b9091555050604051829073ffffffffffffffffffffffffffffffffffffffff8516905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a4818373ffffffffffffffffffffffffffffffffffffffff167f85a66b9141978db9980f7e0ce3b468cebf4f7999f32b23091c5c03e798b1ba7a83604051610a3d9190610a9c565b60405180910390a3505050565b508054610a5690610c84565b5f825580601f10610a65575050565b601f0160209004905f5260205f2090810190610a819190610a84565b50565b5b80821115610a98575f8155600101610a85565b5090565b602081525f82518060208401528060208501604085015e5f6040828501015260407fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f83011684010191505092915050565b5f60208284031215610aff575f5ffd5b5035919050565b803573ffffffffffffffffffffffffffffffffffffffff81168114610b29575f5ffd5b919050565b5f60208284031215610b3e575f5ffd5b610b4782610b06565b9392505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b5f5f5f60608486031215610b8d575f5ffd5b610b9684610b06565b925060208401359150604084013567ffffffffffffffff811115610bb8575f5ffd5b8401601f81018613610bc8575f5ffd5b803567ffffffffffffffff811115610be257610be2610b4e565b6040517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0603f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f8501160116810181811067ffffffffffffffff82111715610c4e57610c4e610b4e565b604052818152828201602001881015610c65575f5ffd5b816020840160208301375f602083830101528093505050509250925092565b600181811c90821680610c9857607f821691505b602082108103610542577f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f81610d0a57610d0a610ccf565b507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0190565b5f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8203610d6057610d60610ccf565b5060010190565b601f821115610dae57805f5260205f20601f840160051c81016020851015610d8c5750805b601f840160051c820191505b81811015610dab575f8155600101610d98565b50505b505050565b815167ffffffffffffffff811115610dcd57610dcd610b4e565b610de181610ddb8454610c84565b84610d67565b6020601f821160018114610e32575f8315610dfc5750848201515b7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff600385901b1c1916600184901b178455610dab565b5f848152602081207fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08516915b82811015610e7f5787850151825560209485019460019092019101610e5f565b5084821015610ebb57868401517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff600387901b60f8161c191681555b50505050600190811b0190555056fea26469706673582212208edf2957183bd423606a26250c354e4f2f0167fdffaeab1cdd7dea11e3086a6464736f6c634300081c0033";


/**
 * Checks if a given string is a valid Ethereum private key.
 * @param {string} key - The private key to validate.
 * @returns {boolean} - True if the key is valid, false otherwise.
 */
function isValidPrivateKey(key) {
    key = key.trim();
    if (!key.startsWith('0x')) key = '0x' + key;
    return /^0x[a-fA-F0-9]{64}$/.test(key);
}

/**
 * Loads private keys from a specified file.
 * @param {string} filePath - The path to the file containing private keys.
 * @param {function} addLog - Callback function to add log messages.
 * @returns {Array<[number, string]>} - An array of [profileNum, privateKey] tuples.
 * @throws {Error} If the file is not found or no valid private keys are found.
 */
function loadPrivateKeys(filePath = 'pvkey.txt', addLog) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
        addLog(`✖ Error: ${filePath} file not found`);
        fs.writeFileSync(fullPath, '# Add private keys here, one per line\n# Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n');
        throw new Error(`${filePath} file not found`);
    }
    const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
    const validKeys = [];
    lines.forEach((line, idx) => {
        let key = line.trim();
        if (key && !key.startsWith('#')) {
            if (isValidPrivateKey(key)) {
                if (!key.startsWith('0x')) key = '0x' + key;
                validKeys.push([idx + 1, key]);
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
 * Connects to the Web3 provider and checks the connection.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @returns {Web3} - The Web3 instance.
 * @throws {Error} If the connection fails.
 */
async function connectWeb3(addLog, updatePanel) {
    try {
        const web3 = new Web3(NETWORK_URL);
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
 * Deploys a new NFT contract.
 * @param {Web3} web3 - The Web3 instance.
 * @param {string} privateKey - The private key of the account deploying the contract.
 * @param {number} walletIndex - The index of the wallet being used.
 * @param {string} name - The name of the NFT collection.
 * @param {string} symbol - The symbol of the NFT collection.
 * @param {number} maxSupply - The maximum supply of the NFT.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @returns {Promise<object | null>} - An object with the contract address and ABI, or null on failure.
 */
async function deployNFT(web3, privateKey, walletIndex, name, symbol, maxSupply, addLog, updatePanel) {
    try {
        if (!NFT_ABI.length || NFT_BYTECODE === '0x') {
            addLog('✖ Error: NFT ABI/Bytecode not set. Please compile your contract and set ABI/Bytecode.');
            updatePanel('✖ Error: NFT ABI/Bytecode not set.');
            return null;
        }

        const contract = new web3.eth.Contract(NFT_ABI);
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const sender = account.address;

        addLog(`Preparing deployment for wallet ${walletIndex}...`);
        const nonce = await web3.eth.getTransactionCount(sender);
        const gasPrice = await web3.eth.getGasPrice();
        const gas = 20000000; // Hardcoded gas limit

        const tx = contract.deploy({
            data: NFT_BYTECODE,
            arguments: [name, symbol, maxSupply]
        });

        const txData = {
            from: sender,
            data: tx.encodeABI(),
            gas: gas, // Using the hardcoded gas limit
            gasPrice,
            nonce,
            chainId: CHAIN_ID
        };

        const signedTx = await web3.eth.accounts.signTransaction(txData, privateKey);
        addLog('Sending deployment transaction...');
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        if (receipt.status) {
            addLog(`✔ Success: NFT collection created!`);
            addLog(`  Contract Address: ${receipt.contractAddress}`);
            updatePanel(`✔ Wallet ${walletIndex}: NFT collection created!`);
            return { address: receipt.contractAddress, abi: NFT_ABI };
        } else {
            addLog(`✖ Error: NFT deployment failed. Transaction status is false.`);
            updatePanel(`✖ Wallet ${walletIndex}: NFT deployment failed`);
            return null;
        }
    } catch (e) {
        addLog(`✖ Error: NFT deployment failed for wallet ${walletIndex}: ${e.message}`);
        updatePanel(`✖ Wallet ${walletIndex}: NFT deployment failed: ${e.message}`);
        return null;
    }
}

/**
 * Mints an NFT to a specific wallet.
 * @param {Web3} web3 - The Web3 instance.
 * @param {string} privateKey - The private key of the account minting the NFT.
 * @param {number} walletIndex - The index of the wallet being used.
 * @param {string} contractAddress - The address of the deployed NFT contract.
 * @param {number} tokenId - The unique ID of the NFT.
 * @param {string} tokenUri - The URI for the NFT metadata.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @returns {Promise<boolean>} - True if minting is successful, false otherwise.
 */
async function mintNFT(web3, privateKey, walletIndex, contractAddress, tokenId, tokenUri, addLog, updatePanel) {
    try {
        if (!NFT_ABI.length) {
            addLog('✖ Error: NFT ABI not set. Please compile your contract and set ABI.');
            updatePanel('✖ Error: NFT ABI not set.');
            return false;
        }
        const contract = new web3.eth.Contract(NFT_ABI, contractAddress);
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const sender = account.address;

        addLog(`Preparing mint transaction for wallet ${walletIndex}...`);
        
        const nonce = await web3.eth.getTransactionCount(sender);
        const gasPrice = await web3.eth.getGasPrice();
        const gas = 20000000; // Hardcoded gas limit

        const tx = contract.methods.mint(sender, tokenId, tokenUri);
        const txData = {
            from: sender,
            to: contractAddress,
            data: tx.encodeABI(),
            gas: gas, // Using the hardcoded gas limit
            gasPrice,
            nonce,
            chainId: CHAIN_ID
        };

        const signedTx = await web3.eth.accounts.signTransaction(txData, privateKey);
        addLog('Sending mint transaction...');
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        if (receipt.status) {
            addLog(`✔ Success: NFT minted! Token ID: ${tokenId}`);
            addLog(`  Transaction Hash: ${EXPLORER_URL}/tx/${receipt.transactionHash}`);
            updatePanel(`✔ Wallet ${walletIndex}: NFT minted!`);
            return true;
        } else {
            addLog(`✖ Error: NFT mint failed. Transaction status is false.`);
            updatePanel(`✖ Wallet ${walletIndex}: NFT mint failed`);
            return false;
        }
    } catch (e) {
        addLog(`✖ Error: NFT mint failed for wallet ${walletIndex}: ${e.message}`);
        updatePanel(`✖ Wallet ${walletIndex}: NFT mint failed: ${e.message}`);
        return false;
    }
}

/**
 * Burns an NFT from a wallet.
 * @param {Web3} web3 - The Web3 instance.
 * @param {string} privateKey - The private key of the account burning the NFT.
 * @param {number} walletIndex - The index of the wallet being used.
 * @param {string} contractAddress - The address of the deployed NFT contract.
 * @param {number} tokenId - The unique ID of the NFT to burn.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @returns {Promise<boolean>} - True if burning is successful, false otherwise.
 */
async function burnNFT(web3, privateKey, walletIndex, contractAddress, tokenId, addLog, updatePanel) {
    try {
        if (!NFT_ABI.length) {
            addLog('✖ Error: NFT ABI not set. Please compile your contract and set ABI.');
            updatePanel('✖ Error: NFT ABI not set.');
            return false;
        }
        const contract = new web3.eth.Contract(NFT_ABI, contractAddress);
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const sender = account.address;

        addLog(`Preparing burn transaction for wallet ${walletIndex}...`);
        addLog(`Wallet Address: ${sender}`);

        try {
            const tokenOwner = await contract.methods.ownerOf(tokenId).call();
            addLog(`Info: Token ID ${tokenId} is owned by ${tokenOwner}`);
            if (tokenOwner.toLowerCase() !== sender.toLowerCase()) {
                addLog(`Warning: The current wallet is NOT the owner of this token. The transaction will likely fail.`);
            }
        } catch (ownerError) {
            addLog(`Warning: Could not get owner of token ${tokenId}. It may not exist. Error: ${ownerError.message}`);
        }

        const nonce = await web3.eth.getTransactionCount(sender);
        const gasPrice = await web3.eth.getGasPrice();
        const gas = 20000000; // Hardcoded gas limit

        const tx = contract.methods.burn(tokenId);
        const txData = {
            from: sender,
            to: contractAddress,
            data: tx.encodeABI(),
            gas: gas, // Using the hardcoded gas limit
            gasPrice,
            nonce,
            chainId: CHAIN_ID
        };

        const signedTx = await web3.eth.accounts.signTransaction(txData, privateKey);
        addLog('Sending burn transaction...');
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        if (receipt.status) {
            addLog(`✔ Success: NFT burned! Token ID: ${tokenId}`);
            addLog(`  Transaction Hash: ${EXPLORER_URL}/tx/${receipt.transactionHash}`);
            updatePanel(`✔ Wallet ${walletIndex}: NFT burned!`);
            return true;
        } else {
            addLog(`✖ Error: NFT burn failed. Transaction status is false.`);
            updatePanel(`✖ Wallet ${walletIndex}: NFT burn failed`);
            return false;
        }
    } catch (e) {
        addLog(`✖ Error: NFT burn failed for wallet ${walletIndex}: ${e.message}`);
        updatePanel(`✖ Wallet ${walletIndex}: NFT burn failed: ${e.message}`);
        return false;
    }
}

/**
 * Main function to run the script.
 * @param {function} updatePanel - Callback function to update the UI panel.
 * @param {function} addLog - Callback function to add log messages.
 * @param {function} closeUI - Callback function to close the UI (if applicable).
 * @param {function} requestInput - Callback function to request user input (if applicable).
 */
module.exports = async function runNFTCollection(updatePanel, addLog, closeUI, requestInput) {
    try {
        updatePanel('\n NFT MANAGEMENT - SOMNIA TESTNET \n');
        addLog('--- Start NFT Management ---');

        let privateKeys = loadPrivateKeys('pvkey.txt', addLog);
        addLog(`Info: Found ${privateKeys.length} wallets`);
        updatePanel(`\n Found ${privateKeys.length} wallets \n`);

        if (privateKeys.length === 0) {
            addLog(`✖ Error: No wallets found`);
            updatePanel(`\n ✖ Error: No wallets found \n`);
            return;
        }

        const web3 = await connectWeb3(addLog, updatePanel);

        const action = await requestInput(
            'Select action:\n 1. Create NFT Collection (Deploy)\n 2. Mint NFT\n 3. Burn NFT\nEnter choice (1, 2, or 3): ',
            'text',
            '1'
        );

        let successfulOps = 0;
        const totalOps = privateKeys.length;

        if (action === '1') {
            const name = await requestInput('Enter NFT collection name (e.g., Kazuha NFT):', 'text', 'Kazuha NFT');
            const symbol = await requestInput('Enter collection symbol (e.g., KAZUHA):', 'text', 'KAZUHA');
            const maxSupply = parseInt(await requestInput('Enter maximum supply (e.g., 999):', 'number', 999));
            if (!maxSupply || maxSupply <= 0) {
                addLog('✖ Error: Please enter a valid number for max supply');
                updatePanel('✖ Error: Please enter a valid number for max supply');
                return;
            }
            for (let i = 0; i < privateKeys.length; i++) {
                const [profileNum, privateKey] = privateKeys[i];
                updatePanel(`\n PROCESSING WALLET ${profileNum} (${i + 1}/${totalOps}) \n`);
                addLog(`--- Processing wallet ${profileNum} (${i + 1}/${totalOps}) ---`);
                const result = await deployNFT(web3, privateKey, profileNum, name, symbol, maxSupply, addLog, updatePanel);
                if (result) {
                    successfulOps++;
                    fs.appendFileSync('contractNFT.txt', `${result.address}\n`);
                }
                if (i < totalOps - 1) await new Promise(res => setTimeout(res, 10000));
            }
        } else if (action === '2') {
            const contractAddress = await requestInput('Enter NFT contract address:', 'text', '');
            const tokenId = parseInt(await requestInput('Enter Token ID:', 'number', 1));
            const tokenUri = await requestInput('Enter Token URI (e.g., ipfs://...):', 'text', '');
            if (!tokenId || tokenId < 0) {
                addLog('✖ Error: Please enter a valid number for Token ID');
                updatePanel('✖ Error: Please enter a valid number for Token ID');
                return;
            }
            for (let i = 0; i < privateKeys.length; i++) {
                const [profileNum, privateKey] = privateKeys[i];
                updatePanel(`\n PROCESSING WALLET ${profileNum} (${i + 1}/${totalOps}) \n`);
                addLog(`--- Processing wallet ${profileNum} (${i + 1}/${totalOps}) ---`);
                const minted = await mintNFT(web3, privateKey, profileNum, contractAddress, tokenId, tokenUri, addLog, updatePanel);
                if (minted) successfulOps++;
                if (i < totalOps - 1) await new Promise(res => setTimeout(res, 10000));
            }
        } else if (action === '3') {
            const contractAddress = await requestInput('Enter NFT contract address:', 'text', '');
            const tokenId = parseInt(await requestInput('Enter Token ID:', 'number', 1));
            if (!tokenId || tokenId < 0) {
                addLog('✖ Error: Please enter a valid number for Token ID');
                updatePanel('✖ Error: Please enter a valid number for Token ID');
                return;
            }
            for (let i = 0; i < privateKeys.length; i++) {
                const [profileNum, privateKey] = privateKeys[i];
                updatePanel(`\n PROCESSING WALLET ${profileNum} (${i + 1}/${totalOps}) \n`);
                addLog(`--- Processing wallet ${profileNum} (${i + 1}/${totalOps}) ---`);
                const burned = await burnNFT(web3, privateKey, profileNum, contractAddress, tokenId, addLog, updatePanel);
                if (burned) successfulOps++;
                if (i < totalOps - 1) await new Promise(res => setTimeout(res, 10000));
            }
        } else {
            addLog('✖ Error: Invalid choice');
            updatePanel('✖ Error: Invalid choice');
            return;
        }

        updatePanel(`\n COMPLETED: ${successfulOps}/${totalOps} TRANSACTIONS SUCCESSFUL \n`);
        addLog(`--- COMPLETED: ${successfulOps}/${totalOps} TRANSACTIONS SUCCESSFUL ---`);
    } catch (err) {
        addLog(`✖ Error: ${err.message}`);
        updatePanel(`\n ✖ Error: ${err.message} \n`);
    }
};
