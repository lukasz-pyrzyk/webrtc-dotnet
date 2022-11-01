"use strict";

const connection = new signalR.HubConnectionBuilder().withUrl("/channel").build();
const localVideo = document.getElementById('localVideo');
const rooms = document.getElementById('rooms');

$(rooms).DataTable({
    columns: [
        { data: 'id'},
        { data: 'name' },
        { data: 'button' },
    ],
    "lengthChange": false,
    "searching": false,
    "language": {
        "emptyTable": "No room available"
    }
});

const configuration = {
    'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
    }]
};

const mediaConfiguration = {
    audio: true,
    video: true
}

const peerConn = new RTCPeerConnection(configuration);

function setupMediaConfiguration() {
    navigator.mediaDevices
        .getUserMedia(mediaConfiguration)
        .then(stream => {
            peerConn.addStream(stream);
            localVideo.srcObject = stream;
        })
        .catch((err) => {
            alert(`Media configuration error ${err}`)
        });
}

setupMediaConfiguration();

// Connect to the signaling server
$(createRoom).click(function () {
    var name = roomName.value;
    connection
        .invoke("CreateRoom", name)
        .catch(function (err) {
            alert(err.toString());
        });
});

connection.start().then(function () {
    connection.on('RoomsUpdated', function (receivedRooms) {
        var rows = receivedRooms.map(x => {
            return {
                id: x.id,
                name: x.name,
                button: "<button>Join</button>"
          
            }
        });

        $(rooms).DataTable().clear().rows.add(rows).draw();
    });
}).catch(function (err) {
    alert(err.toString());
});