using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEngine;

public class CsvPlaybackManager : MonoBehaviour
{
    [Header("CSV File")]
    public string csvFileName = "wind_2018.csv"; // inside StreamingAssets

    [Header("Playback Settings")]
    public bool playFromCSV = true;
    public float secondsPerDay = 10f; // 1 day = X real seconds
    public float playbackSpeed = 1f;  // multiplier (1x, 2x, etc.)

    [Header("Internal State")]
    public int currentIndex = 0;
    public float simTime = 0f;

    List<WindSample> samples = new List<WindSample>();
    WindManager windManager;
    public int CurrentIndex => currentIndex;


    void Start()
    {
        windManager = FindAnyObjectByType<WindManager>();
        LoadCsv();
    }

    void Update()
    {
        if (!playFromCSV || samples.Count < 2 || windManager.manualMode)
            return;

        float dtReal = Time.deltaTime * playbackSpeed;

        // 144 datapoints per day → 10 minutes apart = 600 seconds real world
        float dayDurationCSV = 144 * 600f;
        float simSpeed = dayDurationCSV / secondsPerDay;

        simTime += dtReal * simSpeed;

        while (currentIndex < samples.Count - 2 &&
               simTime >= (samples[currentIndex + 1].timestamp - samples[0].timestamp).TotalSeconds)
        {
            currentIndex++;
        }

        ApplyInterpolatedValues();
    }

    void LoadCsv()
    {
        string path = Path.Combine(Application.streamingAssetsPath, csvFileName);
        if (!File.Exists(path))
        {
            Debug.LogError("CSV file not found: " + path);
            return;
        }

        using (var reader = new StreamReader(path))
        {
            string header = reader.ReadLine(); // skip header

            while (!reader.EndOfStream)
            {
                var line = reader.ReadLine();
                var cols = line.Split(',');

                var sample = new WindSample();

                sample.timestamp = DateTime.ParseExact(
                    cols[0],
                    "dd MM yyyy HH:mm",
                    CultureInfo.InvariantCulture);

                sample.activePower = float.Parse(cols[1], CultureInfo.InvariantCulture);
                sample.windSpeed = float.Parse(cols[2], CultureInfo.InvariantCulture);
                sample.windDirection = float.Parse(cols[3], CultureInfo.InvariantCulture);

                samples.Add(sample);
            }
        }

        samples.Sort((a, b) => a.timestamp.CompareTo(b.timestamp));

        Debug.Log("Loaded " + samples.Count + " CSV samples.");
    }

    void ApplyInterpolatedValues()
    {
        if (currentIndex >= samples.Count - 1) return;

        var s0 = samples[currentIndex];
        var s1 = samples[currentIndex + 1];

        float t0 = (float)(s0.timestamp - samples[0].timestamp).TotalSeconds;
        float t1 = (float)(s1.timestamp - samples[0].timestamp).TotalSeconds;
        float t = Mathf.InverseLerp(t0, t1, simTime);

        float windSpeed = Mathf.Lerp(s0.windSpeed, s1.windSpeed, t);
        float windDir = Mathf.LerpAngle(s0.windDirection, s1.windDirection, t);
        float active = Mathf.Lerp(s0.activePower, s1.activePower, t);

        if (windManager != null)
            windManager.SetWind(windSpeed, windDir);

        // expose to rest of system
        lastWindSpeed = windSpeed;
        lastWindDirection = windDir;
        lastActualPower = active;
    }


    public float lastActualPower { get; private set; }
    public float lastWindSpeed { get; private set; }
    public float lastWindDirection { get; private set; }
    public float LastActivePower => lastActualPower;


    public WindSample GetSample(int index)
    {
        if (index < 0 || index >= samples.Count) return default;
        return samples[index];
    }
}
