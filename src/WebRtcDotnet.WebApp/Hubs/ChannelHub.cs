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
        _logger.LogInformation("Client {connectionId} connected", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception exception)
    {
        _logger.LogInformation("Client {connectionId} disconnected", Context.ConnectionId);
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

            var room = new RoomDTO(Rooms.Count + 1, roomName);
            Rooms.Add(room);
        }

        await Clients.All.SendAsync("RoomsUpdated", Rooms);
    }
}