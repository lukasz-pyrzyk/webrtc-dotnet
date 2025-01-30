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
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302",
        },
        {
            urls: "turn:20.160.188.245",
            username: "username1",
            credential: "key1",
        },
    ]
});

connection.onconnectionstatechange = (ev) => {
    switch (connection.connectionState) {
        case "new":
        case "checking":
            setOnlineStatus("Connecting…");
            break;
        case "connected":
            setOnlineStatus("Online");
            break;
        case "disconnected":
            setOnlineStatus("Disconnecting…");
            break;
        case "closed":
            setOnlineStatus("Offline");
            break;
        case "failed":
            setOnlineStatus("Error");
            break;
        default:
            setOnlineStatus(connection.connectionState);
            break;
    }
}

function setOnlineStatus(status) {
    console.info(status);
}

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

async function startMediaStream() {
    try {
        console.log("Requesting media stream...");

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("getUserMedia is not supported in this browser.");
        }

        const constraints = {
            audio: true,
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Media stream acquired.", stream);

        stream.getTracks().forEach(track => {
            console.log(`Adding track: ${track.kind}`);
            connection.addTrack(track, stream);
        });

        if (localVideo) {
            localVideo.srcObject = stream;
            console.log("Video stream assigned to localVideo element.");
        } else {
            console.error("localVideo element not found.");
        }
    } catch (error) {
        console.error("Error accessing media devices:", error);

        if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            alert("No camera or microphone found. Please check your devices.");
        } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
            alert("Camera or microphone is already in use by another application.");
        } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            alert("Permission to access camera/microphone was denied.");
        } else if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
            alert("Requested media constraints cannot be satisfied. Try different settings.");
        } else {
            alert("An unknown error occurred while accessing media devices.");
        }
    }
}

startMediaStream();


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
            console.error("Joining failed");
            return;
        }

        room.Id = roomId;
        room.Initiating = firstClient;
        console.log(`Joined room ${room.Id}, initiating: ${room.Initiating}`);
    });

    signalling.on('Ready', async function () {
        console.log("Room ready, both participants are present");
        if (room.Initiating) {
            console.log("Starting peer to peer connection as initializator");
            await connection.createOffer();
            await onLocalSessionCreated();
        }
        else {
            console.log("Waiting for connection to start");
        }
    });
    signalling.on('Message', async function (message) {
        if (message.type === 'offer') {
            console.log('Got offer. Sending answer to peer.', message);
            await connection.setRemoteDescription(new RTCSessionDescription(message));
            await connection.createAnswer();
            await onLocalSessionCreated();
        } else if (message.type === 'answer') {
            console.log('Got answer.', message);
            await connection.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === 'candidate') {
            console.log(`Got new candidate from remote peer`, message);
            if (connection.signalingState !== "stable") { // wait for remote description. We should also queue incoming ice servers until we got the remote into
                if (message.candidate === '') {
                    // it end of the candidates, set empty candidate
                    console.log("Adding empty candidate");
                    connection.addIceCandidate({ candidate: '' }).catch((e) => {
                        console.log(`Failure during addIceCandidate(): ${e.name}`);
                    });
                }
                else {
                    try {
                        await connection.addIceCandidate(new RTCIceCandidate({ candidate: message.candidate }));
                    } catch (e) {
                        console.error(`Unable to add ice candidate`, message.candidate);
                    }
                }
            }
        }
    });
}).catch(onError);

async function onLocalSessionCreated(desc) {
    console.log('local session created:', desc);
    await connection.setLocalDescription(desc);
    console.log('sending local description:', connection.localDescription);
    sendMessage(connection.localDescription);
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
}``