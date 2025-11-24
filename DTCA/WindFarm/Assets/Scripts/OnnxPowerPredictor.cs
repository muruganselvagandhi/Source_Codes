using System;
using System.IO;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using UnityEngine;

public class OnnxPowerPredictor : MonoBehaviour
{
    [Header("Files")]
    public string onnxFileName = "model.onnx";             // in StreamingAssets
    public string outputFileName = "power_comparison.csv"; // in StreamingAssets

    private CsvPlaybackManager csv;
    private MqttWindClient mqtt;
    private SimulationManager simManager;
    private InferenceSession session;

    private StreamWriter writer;
    private int lastLoggedCsvIndex = -1;
    private DateTime lastLoggedMqttTime = DateTime.MinValue;

    public float predictedPower { get; private set; }

    void Start()
    {
        // Find references
        csv = FindAnyObjectByType<CsvPlaybackManager>();
        mqtt = FindAnyObjectByType<MqttWindClient>();
        simManager = FindAnyObjectByType<SimulationManager>();

        // --- Load ONNX model ---
        string modelPath = Path.Combine(Application.streamingAssetsPath, onnxFileName);
        session = new InferenceSession(modelPath);
        Debug.Log("ONNX model loaded from " + modelPath);

        // --- Prepare output CSV for comparison ---
        string folder = Application.streamingAssetsPath;
        if (!Directory.Exists(folder))
            Directory.CreateDirectory(folder);

        string outPath = Path.Combine(folder, outputFileName);

        var fs = new FileStream(outPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
        writer = new StreamWriter(fs);

        writer.WriteLine("DateTime,WindSpeed,WindDirection,ActivePower_kW,PredictedPower_kW,Source");
        writer.Flush();

        Debug.Log("Prediction log path: " + outPath);
    }

    void OnDestroy()
    {
        if (session != null)
        {
            session.Dispose();
            session = null;
        }

        if (writer != null)
        {
            writer.Flush();
            writer.Close();
            writer = null;
        }
    }

    void Update()
    {
        if (session == null) return;

        bool usingMqtt = (simManager != null && simManager.useMqtt);

        // ---------- 1. Choose wind speed source (CSV or MQTT) ----------
        float ws = 0f;

        if (usingMqtt && mqtt != null && mqtt.hasData)
        {
            ws = mqtt.latestSpeed;
        }
        else if (csv != null)
        {
            ws = csv.lastWindSpeed;
        }

        // ---------- 2. Run ONNX prediction ----------
        var inputTensor = new DenseTensor<float>(new[] { 1, 1 });
        inputTensor[0, 0] = ws;

        var input = new[]
        {
            NamedOnnxValue.CreateFromTensor("float_input", inputTensor)
        };

        using (var results = session.Run(input))
        {
            foreach (var res in results)
            {
                var outputTensor = res.AsTensor<float>();
                predictedPower = outputTensor[0];
                break; // only first output
            }
        }

        // ---------- 3. Log once per "step" (CSV row or MQTT message) ----------
        if (writer == null) return;

        if (usingMqtt && mqtt != null && mqtt.hasData)
        {
            LogMqttRow();
        }
        else if (csv != null)
        {
            LogCsvRow();
        }
    }

    void LogCsvRow()
    {
        if (csv == null) return;

        int idx = csv.CurrentIndex;
        if (idx == lastLoggedCsvIndex) return; // same row as last frame

        lastLoggedCsvIndex = idx;

        WindSample s = csv.GetSample(idx);

        string line = string.Format(
            "{0:dd MM yyyy HH:mm},{1:F3},{2:F3},{3:F3},{4:F3},CSV",
            s.timestamp,
            s.windSpeed,
            s.windDirection,
            s.activePower,
            predictedPower
        );

        writer.WriteLine(line);
        writer.Flush();

        Debug.Log($"[ONNX CSV] idx={idx} ws={s.windSpeed:F3} pred={predictedPower:F3} actual={s.activePower:F3}");
    }

    void LogMqttRow()
    {
        if (mqtt == null || !mqtt.hasData) return;

        DateTime ts = mqtt.latestTimestamp;
        if (ts == lastLoggedMqttTime) return; // already logged this message

        lastLoggedMqttTime = ts;

        float ws = mqtt.latestSpeed;
        float dir = mqtt.latestDirection;
        float actP = mqtt.latestActivePower;

        // If for some reason timestamp is default, still log something
        string timeString = ts == DateTime.MinValue
            ? ""
            : ts.ToString("dd MM yyyy HH:mm");

        string line = string.Format(
            "{0},{1:F3},{2:F3},{3:F3},{4:F3},MQTT",
            timeString,
            ws,
            dir,
            actP,
            predictedPower
        );

        writer.WriteLine(line);
        writer.Flush();

        Debug.Log($"[ONNX MQTT] t={timeString} ws={ws:F3} pred={predictedPower:F3} actual={actP:F3}");
    }
}
