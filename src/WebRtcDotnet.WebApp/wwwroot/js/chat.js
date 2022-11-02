"use strict";

const signalling = new signalR.HubConnectionBuilder().withUrl("/channel").build();
const localVideo = document.getElementById('localVideo');
const rooms = document.getElementById('rooms');
let roomFirstClient;

$(rooms).DataTable({
    columns: [
        { data: 'Id' },
        { data: 'Name' },
        { data: 'Button' },
    ],
    "lengthChange": false,
    "searching": false,
    "language": {
        "emptyTable": "No room available"
    }
});

$('#rooms tbody').on('click', 'button', function () {
    const data = $(rooms).DataTable().row($(this).parents('tr')).data();
    signalling.invoke("Join", data.Id).catch(function (err) {
        return console.error(err.toString());
    });
});

const configuration = {
    'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
    }]
};

const connection = new RTCPeerConnection(configuration);

function setupMediaConfiguration() {

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
        .catch((err) => {
            alert(`Media configuration error ${err}`)
        });
}

setupMediaConfiguration();

// Connect to the signaling server
$(createRoom).click(function () {
    var name = roomName.value;
    signalling
        .invoke("CreateRoom", name)
        .catch(function (err) {
            alert(err.toString());
        });
});

signalling.start().then(function () {
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

    signalling.on('Joined', function (firstClient) {
        roomFirstClient = firstClient;
        console.log(`Joined room. First client: ${roomFirstClient}`)
        $("#roomsContainer").hide();
    });

    signalling.on('Ready', function () {
        console.log("Room ready, both participants are present");

        connection.createOffer()
            .then((offer) => connection.setLocalDescription(offer))
            //.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
            //.then(() => remoteConnection.createAnswer())
            //.then((answer) => remoteConnection.setLocalDescription(answer))
            //.then(() => localConnection.setRemoteDescription(remoteConnection.localDescription))
            .catch(function (err) {
                alert(err.toString());
            });
    });

    signalling.invoke("GetRooms").catch(function (err) {
        alert(err.toString());
    });
}).catch(function (err) {
    alert(err.toString());
});