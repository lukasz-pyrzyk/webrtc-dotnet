"use strict";

const signalling = new signalR.HubConnectionBuilder().withUrl("/channel").build();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const rooms = document.getElementById('rooms');
let room = {
    Id: null,
    Initiating: null
};

$(rooms).DataTable({
    columns: [
        { data: 'Id', title: 'Id', width: "15%" },
        { data: 'Name', title: "Name" },
        { data: 'Button', title: "Options", width: "15%" },
    ],
    paging: false,
    lengthChange: false,
    searching: false,
    language: {
        "emptyTable": "No room available, create a new one"
    }
});

$('#rooms tbody').on('click', 'button', function () {
    const data = $(rooms).DataTable().row($(this).parents('tr')).data();
    signalling.invoke("Join", data.Id).catch(onError);
});

const configuration = {
    'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
    }]
};

const connection = new RTCPeerConnection(configuration);

const mediaConfiguration = {
    audio: true,
    video: true
}

navigator.mediaDevices
    .getUserMedia(mediaConfiguration)
    .then(stream => {
        connection.addStream(stream);
        localVideo.srcObject = stream;
    })
    .catch(onError);

$(createRoom).click(function () {
    const name = roomName.value;
    signalling.invoke("CreateRoom", name).catch(onError);
});

signalling.start().then(function () {
    signalling.invoke("GetRooms").catch(onError);

    signalling.on('RoomsUpdated', function (receivedRooms) {
        var rows = receivedRooms.map(x => {
            return {
                Id: x.id,
                Name: x.name,
                Button: "<button>Join</button>"

            }
        });

        $(rooms).DataTable().clear().rows.add(rows).draw();
    });

    signalling.on('Joined', function (roomId, firstClient) {
        room.Id = roomId;
        room.Initiating = firstClient;
        console.log(`Joined room ${room.Id}, initiating: ${room.Initiating}`)
        $("#roomsContainer").hide();
    });

    signalling.on('Ready', function () {
        console.log("Room ready, both participants are present");
        connectPeers();
    });

    signalling.on('Message', function (message) {
        console.log('Client received message:', message);
        signalingMessageCallback(message);
    });
}).catch(onError);

function connectPeers() {
    connection.onicecandidate = function (event) {
        console.log('icecandidate event:', event);
        sendMessage(connection.localDescription);
    };

    connection.ontrack = function (event) {
        console.log('icecandidate ontrack event:', event);
        remoteVideo.srcObject = event.streams[0];
    };

    if (room.Initiating) {
        console.log("Starting peer to peer connection as initializator");
        connection.createOffer(onLocalSessionCreated, onError);
    }
    else {
        console.log("Waiting for connection to start");
    }
}

function signalingMessageCallback(message) {
    if (message.type === 'offer') {
        console.log('Got offer. Sending answer to peer.');
        connection.setRemoteDescription(new RTCSessionDescription(message), function () { }, onError);
        connection.createAnswer(onLocalSessionCreated, onError);

    } else if (message.type === 'answer') {
        console.log('Got answer.');
        connection.setRemoteDescription(new RTCSessionDescription(message), function () { }, onError);

    } else if (message.type === 'candidate') {
        connection.addIceCandidate(new RTCIceCandidate({
            candidate: message.candidate
        }));
    }
}

function onLocalSessionCreated(desc) {
    console.log('local session created:', desc);
    connection.setLocalDescription(desc, function () { }, onError);
}

function sendMessage(message) {
    console.log(`Client sending a message to the room: ${room.Id} ${message}`);
    signalling.invoke("SendMessage", room.Id, message).catch(onError);
}

function onError(err) {
    if (!err) return;
    if (typeof err === 'string') {
        console.error(err);
    } else {
        console.error(err.toString(), err);
    }
}