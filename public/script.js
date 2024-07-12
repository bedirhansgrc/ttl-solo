const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const dataDiv = document.getElementById('data');
const baudRateInput = document.getElementById('baudRateInput');
const setBaudRateButton = document.getElementById('setBaudRateButton');
const exportButton = document.getElementById('exportButton');
const pairedStatus = document.getElementById('pairedStatus');
const importButton = document.getElementById('importButton');
const importFile = document.getElementById('importFile');
const form = document.getElementById('messageForm');
let baudRate;
let ports = [];
let readers = [];
let writers = [];
let messageCount = 0;
let allMessages = [];
let isConnected = false;

setBaudRateButton.addEventListener('click', () => {
    const baudRateValue = baudRateInput.value.trim();
    if (baudRateValue) {
        baudRate = parseInt(baudRateValue, 10);
        alert(`Baud rate set to ${baudRate}`);
    } else {
        alert('Please enter baud rate');
    }
});

connectButton.addEventListener('click', async () => {
    if (!baudRate) {
        alert('Please enter baud rate');
        return;
    }

    try {
        console.log('Connecting to serial port...');

        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: baudRate });
        const reader = port.readable.getReader();
        const writer = port.writable.getWriter();

        ports.push(port);
        readers.push(reader);
        writers.push(writer);

        console.log(`Connected to port with baud rate ${baudRate}`);
        isConnected = true;
        pairedStatus.style.display = 'inline';

        readPort(reader);
    } catch (error) {
        console.error('Error connecting to serial port:', error);
        isConnected = false;
    }
});

disconnectButton.addEventListener('click', () => {
    if (ports.length > 0) {
        ports.forEach((port, index) => {
            closePort(index);
        });
        alert('All ports disconnected');
        isConnected = false;
        pairedStatus.style.display = 'none';
    } else {
        alert('No ports to disconnect');
    }
});

exportButton.addEventListener('click', () => {
    if (allMessages.length === 0) {
        alert('No messages to export.');
        return;
    }
    const exportData = allMessages.map((message, index) => ({
        number: index + 1,
        message: message
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'messages.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

importButton.addEventListener('click', () => {
    importFile.click();
});

importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const messages = JSON.parse(e.target.result);
                importMessages(messages);
            } catch (error) {
                alert('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    }
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    let message = document.getElementById('message').value.trim();
    if (message) {
        sendMessage(message);
        document.getElementById('message').value = '';
    }
});

async function readPort(reader) {
    let buffer = '';
    const decoder = new TextDecoder('utf-8');

    while (isConnected) {
        try {
            const { value, done } = await reader.read();
            if (done) {
                console.log('Serial port reading finished');
                break;
            }
            if (value) {
                buffer += decoder.decode(value, { stream: true });
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const completeMessage = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (completeMessage) {
                        console.log(`Data received: ${completeMessage}`);
                        displayMessage(completeMessage, 'received');
                    }
                }
            }
        } catch (error) {
            console.error('Error reading from port:', error);
            break;
        }
    }
}

function closePort(portNumber) {
    if (ports[portNumber]) {
        readers[portNumber].releaseLock();
        writers[portNumber].releaseLock();
        ports[portNumber].close().then(() => {
            console.log(`Port closed`);
        }).catch(error => {
            console.error('Error closing port:', error);
        });
    }
}

function importMessages(messages) {
    messages.forEach(msg => {
        const messageText = msg.message;
        displayMessage(messageText, 'imported');
    });
}

function displayMessage(message, type = 'received') {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add(type === 'sent' ? 'message-sent' : 'message-received');

    const p = document.createElement('p');
    p.innerText = message;
    messageContainer.appendChild(p);

    const now = new Date();
    const timeString = now.toLocaleTimeString();

    const timeSpan = document.createElement('span');
    timeSpan.innerText = timeString;
    timeSpan.classList.add('message-time');

    messageContainer.appendChild(timeSpan);

    dataDiv.appendChild(messageContainer);
    dataDiv.scrollTop = dataDiv.scrollHeight;

    if (type === 'sent' && !allMessages.includes(message)) {
        addToMessageList(message, type);
        allMessages.push(message);
    }
    if (type === 'imported' && !allMessages.includes(message)) {
        addToMessageList(message, type);
        allMessages.push(message);
    }
}

function addToMessageList(message, type) {
    const messageList = document.getElementById('messageList');
    const messageListItem = document.createElement('div');
    messageListItem.classList.add('message-item');

    const messageNumber = document.createElement('div');
    messageNumber.classList.add('message-number');
    messageNumber.innerText = ++messageCount;
    messageListItem.appendChild(messageNumber);

    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.innerText = message;
    messageListItem.appendChild(messageText);

    const pinButton = document.createElement('button');
    pinButton.classList.add('pin-button');
    pinButton.innerText = '📌';
    pinButton.addEventListener('click', () => togglePinMessage(messageListItem));
    messageListItem.appendChild(pinButton);

    const deleteButton = document.createElement('button');
    deleteButton.classList.add('delete-button');
    deleteButton.innerText = '🗑️';
    deleteButton.addEventListener('click', () => deleteMessage(messageListItem, message));
    messageListItem.appendChild(deleteButton);

    const resendButton = document.createElement('button');
    resendButton.classList.add('resend-button');
    resendButton.innerText = '🔄';
    resendButton.addEventListener('click', () => resendMessage(message));
    messageListItem.appendChild(resendButton);

    messageList.prepend(messageListItem);
}

function deleteMessage(messageItem, message) {
    const messageList = document.getElementById('messageList');
    messageList.removeChild(messageItem);
    allMessages = allMessages.filter(msg => msg !== message);
}

function togglePinMessage(messageItem) {
    const messageList = document.getElementById('messageList');
    if (messageItem.classList.contains('pinned-message')) {
        messageItem.classList.remove('pinned-message');
    } else {
        messageItem.classList.add('pinned-message');
    }
}

function resendMessage(message) {
    sendMessage(message);
}

async function sendMessage(message) {
    if (!baudRate || ports.length === 0) {
        alert('Please set the baud rate and connect to a serial port before sending a message.');
        return;
    }

    message = message.replace(/\s+/g, '');

    const data = new TextEncoder().encode(message + '\n');

    try {
        for (let i = 0; i < writers.length; i++) {
            await writers[i].write(data);
            console.log(`Message sent: ${message}`);
            displayMessage(message, 'sent');
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}
