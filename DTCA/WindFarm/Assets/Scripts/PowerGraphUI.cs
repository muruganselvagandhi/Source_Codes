using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

[RequireComponent(typeof(RawImage))]
public class PowerGraphUI : MonoBehaviour
{
    [Header("Data Sources")]
    public OnnxPowerPredictor predictor;
    public CsvPlaybackManager csvPlayback;
    public MqttWindClient mqttClient;
    public SimulationManager simManager;

    [Header("Graph Settings")]
    public int width = 256;
    public int height = 128;
    public float maxPower = 1500f;      // kW, adjust to your data
    public float sampleInterval = 0.1f; // seconds between samples
    public float activeDelaySeconds = 1.0f; // delay actual vs predicted

    public Color backgroundColor = new Color(0, 0, 0, 0.6f);
    public Color predictedColor = Color.cyan;
    public Color actualColor = Color.yellow;

    private Texture2D tex;
    private float[] predictedBuf;
    private float[] actualBuf;

    private float nextSampleTime;
    private Queue<float> actualQueue;
    private int delaySamples;

    [Header("Legend")]
    public bool showLegend = true;
    public string predictedLabel = "Predicted";
    public string actualLabel = "Actual";
    public Color legendPredictedColor = Color.cyan;
    public Color legendActualColor = Color.yellow;

    // Simple 5x7 pixel font (only characters we need)
    static readonly Dictionary<char, byte[]> tinyFont = new Dictionary<char, byte[]>
    {
        // Each char = 5 columns, each column = 7 bits of vertical pixels (top bit = top pixel)
        ['A'] = new byte[] { 0x7C, 0x12, 0x11, 0x12, 0x7C },
        ['C'] = new byte[] { 0x3C, 0x42, 0x41, 0x41, 0x22 },
        ['D'] = new byte[] { 0x7F, 0x41, 0x41, 0x22, 0x1C },
        ['E'] = new byte[] { 0x7F, 0x49, 0x49, 0x49, 0x41 },
        ['I'] = new byte[] { 0x41, 0x7F, 0x41, 0x00, 0x00 },
        ['L'] = new byte[] { 0x7F, 0x40, 0x40, 0x40, 0x40 },
        ['P'] = new byte[] { 0x7F, 0x09, 0x09, 0x09, 0x06 },
        ['R'] = new byte[] { 0x7F, 0x09, 0x19, 0x29, 0x46 },
        ['T'] = new byte[] { 0x01, 0x01, 0x7F, 0x01, 0x01 },
        ['U'] = new byte[] { 0x3F, 0x40, 0x40, 0x40, 0x3F },
        [' '] = new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00 }
    };

    void Start()
    {
        if (predictor == null) predictor = FindAnyObjectByType<OnnxPowerPredictor>();
        if (csvPlayback == null) csvPlayback = FindAnyObjectByType<CsvPlaybackManager>();
        if (mqttClient == null) mqttClient = FindAnyObjectByType<MqttWindClient>();
        if (simManager == null) simManager = FindAnyObjectByType<SimulationManager>();

        tex = new Texture2D(width, height, TextureFormat.RGBA32, false);
        tex.wrapMode = TextureWrapMode.Clamp;
        tex.filterMode = FilterMode.Bilinear;

        GetComponent<RawImage>().texture = tex;

        predictedBuf = new float[width];
        actualBuf = new float[width];

        actualQueue = new Queue<float>();
        delaySamples = Mathf.Max(1, Mathf.RoundToInt(activeDelaySeconds / sampleInterval));

        ClearTexture();
    }

    void ClearTexture()
    {
        var pixels = new Color[width * height];
        for (int i = 0; i < pixels.Length; i++)
            pixels[i] = backgroundColor;
        tex.SetPixels(pixels);
        tex.Apply();
    }

    void Update()
    {
        if (Time.time < nextSampleTime) return;
        nextSampleTime = Time.time + sampleInterval;

        float predicted = predictor != null ? predictor.predictedPower : 0f;

        float actual = 0f;
        if (simManager != null && simManager.useMqtt && mqttClient != null && mqttClient.hasData)
        {
            actual = mqttClient.latestActivePower;
        }
        else if (csvPlayback != null)
        {
            actual = csvPlayback.LastActivePower;
        }

        AddSample(predicted, actual);
        RedrawTexture();
    }

    void AddSample(float predicted, float actual)
    {
        // shift left
        for (int i = 0; i < width - 1; i++)
        {
            predictedBuf[i] = predictedBuf[i + 1];
            actualBuf[i] = actualBuf[i + 1];
        }

        // handle delayed actual via queue
        actualQueue.Enqueue(actual);
        float delayedActual = 0f;
        if (actualQueue.Count > delaySamples)
        {
            delayedActual = actualQueue.Dequeue();
        }

        predictedBuf[width - 1] = predicted;
        actualBuf[width - 1] = delayedActual;
    }

    void RedrawTexture()
    {
        ClearTexture();

        int lastPredY = -1;
        int lastActY = -1;

        for (int x = 0; x < width; x++)
        {
            // Predicted
            float p = Mathf.Clamp01(predictedBuf[x] / maxPower);
            int yp = Mathf.Clamp(Mathf.RoundToInt(p * (height - 1)), 0, height - 1);

            if (lastPredY >= 0)
                DrawLine(x - 1, lastPredY, x, yp, predictedColor);
            else
                tex.SetPixel(x, yp, predictedColor);

            lastPredY = yp;

            // Actual
            float a = Mathf.Clamp01(actualBuf[x] / maxPower);
            int ya = Mathf.Clamp(Mathf.RoundToInt(a * (height - 1)), 0, height - 1);

            if (lastActY >= 0)
                DrawLine(x - 1, lastActY, x, ya, actualColor);
            else
                tex.SetPixel(x, ya, actualColor);

            lastActY = ya;
        }

        // Legend (keep whatever version you have now)
        if (showLegend)
        {
            int paddingX = width - 80;
            int paddingY = 5;

            DrawText(paddingX, paddingY + 15, predictedLabel, legendPredictedColor);
            DrawText(paddingX, paddingY, actualLabel, legendActualColor);
        }

        tex.Apply();
    }

    void DrawLine(int x0, int y0, int x1, int y1, Color color)
    {
        int dx = Mathf.Abs(x1 - x0);
        int dy = Mathf.Abs(y1 - y0);
        int steps = Mathf.Max(dx, dy);
        if (steps == 0)
        {
            if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height)
                tex.SetPixel(x0, y0, color);
            return;
        }

        for (int i = 0; i <= steps; i++)
        {
            float t = i / (float)steps;
            int x = Mathf.RoundToInt(Mathf.Lerp(x0, x1, t));
            int y = Mathf.RoundToInt(Mathf.Lerp(y0, y1, t));

            if (x >= 0 && x < width && y >= 0 && y < height)
                tex.SetPixel(x, y, color);
        }
    }


    void DrawText(int startX, int startY, string text, Color color)
    {
        foreach (char c in text.ToUpper())
        {
            if (!tinyFont.ContainsKey(c))
                continue;

            byte[] columns = tinyFont[c];

            for (int x = 0; x < 5; x++)
            {
                byte col = columns[x];
                for (int y = 0; y < 7; y++)
                {
                    // Check pixel bit
                    if ((col & (1 << y)) != 0)
                    {
                        int px = startX + x;
                        int py = startY + (6 - y); // invert vertically

                        if (px >= 0 && px < width && py >= 0 && py < height)
                            tex.SetPixel(px, py, color);
                    }
                }
            }

            startX += 6; // space between chars
        }
    }

}
