using Microsoft.AspNetCore.SignalR;

namespace WebRtcDotnet.WebApp.Hubs;

public class ChannelHub : Hub
{
    private static readonly object Locker = new();
    private static readonly List<RoomDTO> Rooms = new();

    private readonly ILogger _logger;

    public ChannelHub(ILogger<ChannelHub> logger)
    {
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("Client {clientId} connected", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception exception)
    {
        _logger.LogInformation("Client {clientId} disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task CreateRoom(string roomName)
    {
        _logger.LogInformation("Creating room {roomName}", roomName);

        lock (Locker)
        {
            if (Rooms.Any(x => x.Name.Equals(roomName, StringComparison.OrdinalIgnoreCase)))
            {
                _logger.LogWarning("Room {roomName} already exists", roomName);
                return;
            }

            var room = new RoomDTO((Rooms.Count + 1).ToString(), roomName, new List<string>());
            Rooms.Add(room);
        }

        await Clients.All.SendAsync("RoomsUpdated", Rooms);
    }

    public async Task Join(string roomId)
    {
        RoomDTO room;
        lock (Locker)
        {
            room = Rooms.SingleOrDefault(x => x.Id == roomId);
            if (room is null)
            {
                _logger.LogError("Unable to find room {roomId}", roomId);
                return;
            }

            _logger.LogDebug("Adding participant {clientId} to the room {roomId}", Context.ConnectionId, roomId);
            room.Participants.Add(Context.ConnectionId);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        var isFirstClient = room.Participants.Count == 1;
        await Clients.Caller.SendAsync("Joined", roomId, isFirstClient);
        _logger.LogInformation("Participant {clientId} joined the room {roomId}", Context.ConnectionId, roomId);

        if (room.Participants.Count == 2)
        {
            await Clients.Group(roomId).SendAsync("Ready");
            _logger.LogInformation("Room {roomId} have 2 participants, sending ready information", roomId);
        }
    }

    public async Task SendMessage(string roomId, object message)
    {
        await Clients.OthersInGroup(roomId).SendAsync("Message", message);
    }

    public async Task GetRooms()
    {
        await Clients.All.SendAsync("RoomsUpdated", Rooms);
    }
}