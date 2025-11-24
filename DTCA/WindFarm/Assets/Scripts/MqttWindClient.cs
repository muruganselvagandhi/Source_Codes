using System;
using System.Text;
using System.Threading.Tasks;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Client.Options;
using UnityEngine;
using System.Globalization;


public class MqttWindClient : MonoBehaviour
{
    [Header("HiveMQ Cloud Settings")]
    public string host = "1bb52e5669a44705a46bedceffaee603.s1.eu.hivemq.cloud";
    public int port = 8883;
    public string username = "WindFarm";
    public string password = "Wind1234";

    [Header("Topics")]
    public string arduinoTopic = "windfarm/arduino";
    public string websiteTopic = "windfarm/web";

    [Header("Mode")]
    public bool useWebsiteTopic = false; // false = Arduino topic, true = website topic

    // Latest values received
    public bool hasData { get; private set; }
    public DateTime latestTimestamp { get; private set; }
    public float latestSpeed { get; private set; }
    public float latestDirection { get; private set; }
    public float latestActivePower { get; private set; }
    public bool IsConnected { get; private set; }


    private IMqttClient client;
    private IMqttClientOptions options;

    // Arduino JSON (unchanged)
    [Serializable]
    private class WindJson
    {
        public string time;
        public float speed;
        public float direction;
        public float activePower;
    }
    // Web JSON format
    [Serializable]
    private class WebWindJson
    {
        public float wind_speed;
        public float wind_direction;
        public string direction_label;
        public string timestamp;
        public float predicted_power;
        public string model;
    }


    async void Start()
    {
        await ConnectAndSubscribe();
    }

    async Task ConnectAndSubscribe()
    {
        try
        {
            var factory = new MqttFactory();
            client = factory.CreateMqttClient();

            client.UseConnectedHandler(async e =>
            {
                Debug.Log("MQTT connected to HiveMQ.");

                await client.SubscribeAsync(new MqttTopicFilterBuilder().WithTopic(arduinoTopic).Build());
                await client.SubscribeAsync(new MqttTopicFilterBuilder().WithTopic(websiteTopic).Build());

                Debug.Log("Subscribed to topics: " + arduinoTopic + " and " + websiteTopic);
                IsConnected = true;
            });

            client.UseDisconnectedHandler(e =>
            {
                Debug.LogWarning("MQTT disconnected.");
                IsConnected = false;
            });

            client.UseApplicationMessageReceivedHandler(e =>
            {
                try
                {
                    string topic = e.ApplicationMessage.Topic;
                    string payload = Encoding.UTF8.GetString(e.ApplicationMessage.Payload ?? Array.Empty<byte>());

                    if (!useWebsiteTopic && topic == arduinoTopic)
                    {
                        ParseWindPayload(payload, false);  // Arduino
                    }
                    else if (useWebsiteTopic && topic == websiteTopic)
                    {
                        ParseWindPayload(payload, true);   // Web
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogError("MQTT message handler error: " + ex.Message);
                }
            });

            options = new MqttClientOptionsBuilder()
                .WithTcpServer(host, port)
                .WithCredentials(username, password)
                .WithTls()
                .WithCleanSession()
                .Build();

            await client.ConnectAsync(options);
        }
        catch (Exception ex)
        {
            Debug.LogError("MQTT connect error: " + ex.Message);
        }
    }

    // ⭐ Modified: now supports both Arduino + Web JSON formats
    void ParseWindPayload(string payload, bool isWeb)
    {
        try
        {
            if (isWeb)
            {
                // ⭐ NEW: Web JSON parsing
                var data = JsonUtility.FromJson<WebWindJson>(payload);

                latestSpeed = data.wind_speed;
                latestDirection = data.wind_direction;
                latestActivePower = data.predicted_power;

                // Timestamp is ISO8601 → parse normally
                if (!string.IsNullOrEmpty(data.timestamp))
                {
                    latestTimestamp = DateTime.Parse(
                        data.timestamp,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AdjustToUniversal
                    );
                }

                hasData = true;
                return;
            }

            // Arduino JSON (unchanged)
            var old = JsonUtility.FromJson<WindJson>(payload);

            latestSpeed = old.speed;
            latestDirection = old.direction;
            latestActivePower = old.activePower;

            if (!string.IsNullOrEmpty(old.time))
            {
                latestTimestamp = DateTime.ParseExact(
                    old.time,
                    "dd MM yyyy HH:mm",
                    CultureInfo.InvariantCulture
                );
            }

            hasData = true;
        }
        catch (Exception ex)
        {
            Debug.LogWarning("Failed to parse JSON: " + payload + " | " + ex.Message);
        }
    }


    async void OnDestroy()
    {
        try
        {
            if (client != null && client.IsConnected)
            {
                await client.DisconnectAsync();
            }
        }
        catch { }
    }
}
