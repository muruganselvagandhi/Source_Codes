using UnityEngine;

public class SimulationManager : MonoBehaviour
{
    [Header("References")]
    public CsvPlaybackManager csvPlayback;
    public WindManager windManager;
    public MqttWindClient mqttClient;

    [Header("Input Source")]
    [Tooltip("If true, wind data comes from MQTT. If false, from CSVPlaybackManager.")]
    public bool useMqtt = false;

    [Tooltip("When using MQTT, select which topic to use: false = Arduino, true = Website.")]
    public bool useWebsiteTopic = false;

    // we remember the inspector value of PlayFromCSV so we don't overwrite it permanently
    private bool originalPlayFromCsv = true;
    private bool storedOriginal = false;

    void Start()
    {
        // Auto-wire refs if not set in inspector
        if (csvPlayback == null) csvPlayback = GetComponent<CsvPlaybackManager>();
        if (csvPlayback == null) csvPlayback = FindAnyObjectByType<CsvPlaybackManager>();

        if (windManager == null) windManager = FindAnyObjectByType<WindManager>();
        if (mqttClient == null) mqttClient = FindAnyObjectByType<MqttWindClient>();

        if (csvPlayback != null)
        {
            originalPlayFromCsv = csvPlayback.playFromCSV;
            storedOriginal = true;
        }

        if (mqttClient != null)
        {
            mqttClient.useWebsiteTopic = useWebsiteTopic;
        }
    }

    void Update()
    {
        // Keep MQTT client’s topic selection in sync with inspector
        if (mqttClient != null)
        {
            mqttClient.useWebsiteTopic = useWebsiteTopic;
        }

        if (useMqtt)
        {
            // MQTT MODE: disable CSV playback and drive wind from MQTT
            if (csvPlayback != null)
            {
                csvPlayback.playFromCSV = false;
            }

            if (mqttClient != null && mqttClient.IsConnected && mqttClient.hasData && windManager != null)
            {
                windManager.SetWind(mqttClient.latestSpeed, mqttClient.latestDirection);
            }
        }
        else
        {
            // CSV MODE: restore original PlayFromCSV flag and let CsvPlaybackManager run as usual
            if (csvPlayback != null && storedOriginal)
            {
                csvPlayback.playFromCSV = originalPlayFromCsv;
            }
            // CsvPlaybackManager will call windManager.SetWind() itself in this mode
        }
    }
}
