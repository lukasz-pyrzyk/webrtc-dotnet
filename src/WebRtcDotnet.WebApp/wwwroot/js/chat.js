﻿"use strict";

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
        { data: 'Participants', title: "Participants" },
        { data: 'Buttons', title: "Options", width: "15%" }
    ],
    paging: false,
    lengthChange: false,
    searching: false,
    language: {
        "emptyTable": "No room available, create a new one"
    }
});

$('#rooms tbody').on('click', '.join', function () {
    const data = $(rooms).DataTable().row($(this).parents('tr')).data();
    signalling.invoke("Join", data.Id).catch(onError);
});

$('#rooms tbody').on('click', '.leave', function () {
    const data = $(rooms).DataTable().row($(this).parents('tr')).data();
    $(this).hide();
    signalling.invoke("Leave", data.Id).catch(onError);
    room.Id = null;
    room.Initiating = null;
});

$(createRoom).click(function () {
    const name = roomName.value;
    signalling.invoke("CreateRoom", name).catch(onError);
});

const connection = new RTCPeerConnection({
    'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
    }]
});

connection.onicecandidate = function (event) {
    console.log(`icecandidate event of type ${event.type}:`, event);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    } else {
        console.log('End of candidates.');
        sendMessage(connection.localDescription);
    }
};

connection.ontrack = function (event) {
    console.log('icecandidate ontrack event:', event);
    remoteVideo.srcObject = event.streams[0];
};

navigator.mediaDevices
    .getUserMedia({
        audio: true,
        video: true
    })
    .then(stream => {
        connection.addStream(stream);
        localVideo.srcObject = stream;
    })
    .catch(onError);

signalling.start().then(function () {
    signalling.invoke("GetRooms").catch(onError);

    signalling.on('RoomsUpdated', function (receivedRooms) {
        const rows = receivedRooms.map(x => {
            return {
                Id: x.id,
                Name: x.name,
                Participants: x.participants.join(", "),
                Buttons: x.participants.includes(signalling.connectionId) ? "<button class=\"join\" disabled>Join</button><button class=\"leave\">Leave</button>" : "<button class=\"join\">Join</button><button class=\"leave\" disabled>Leave</button>"
            }
        });

        $(rooms).DataTable().clear().rows.add(rows).draw();
    });

    signalling.on('Joined', function (roomId, firstClient) {
        if (!roomId) {
            conso.err("Joining failed");
            return;
        }

        room.Id = roomId;
        room.Initiating = firstClient;
        console.log(`Joined room ${room.Id}, initiating: ${room.Initiating}`);
    });

    signalling.on('Ready', function () {
        console.log("Room ready, both participants are present");
        if (room.Initiating) {
            console.log("Starting peer to peer connection as initializator");
            connection.createOffer(onLocalSessionCreated, onError);
        }
        else {
            console.log("Waiting for connection to start");
        }
    });

    signalling.on('Message', function (message) {
        console.log('Client received message:', message);
        signalingMessageCallback(message);
    });
}).catch(onError);

function signalingMessageCallback(message) {
    if (message.type === 'offer') {
        console.log('Got offer. Sending answer to peer.');
        connection.setRemoteDescription(new RTCSessionDescription(message), function () { }, onError);
        connection.createAnswer(onLocalSessionCreated, onError);

    } else if (message.type === 'answer') {
        console.log('Got answer.');
        connection.setRemoteDescription(new RTCSessionDescription(message), function () { }, onError);

    } else if (message.type === 'candidate') {
        console.log(`Got new candidate from remote peer`);
        connection.addIceCandidate(new RTCIceCandidate({
            candidate: message.candidate
        }));
    }
}

function onLocalSessionCreated(desc) {
    console.log('local session created:', desc);
    connection.setLocalDescription(desc, function () {
        console.log('sending local desciption:', connection.localDescription);
        sendMessage(connection.localDescription);
    }, onError);
}

function sendMessage(message) {
    console.log(`Client sending a message to the room: ${room.Id}`);
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