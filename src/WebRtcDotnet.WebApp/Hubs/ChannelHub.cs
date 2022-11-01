using Microsoft.AspNetCore.SignalR;

namespace WebRtcDotnet.WebApp.Hubs;

public class ChannelHub : Hub
{
    private readonly ILogger _logger;

    public ChannelHub(ILogger<ChannelHub> logger)
    {
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("Connecting");
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception exception)
    {
        _logger.LogInformation("Disconnecting");
        return base.OnDisconnectedAsync(exception);
    }
}