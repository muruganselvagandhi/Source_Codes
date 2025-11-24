using System;

[Serializable]
public struct WindSample
{
    public DateTime timestamp;
    public float windSpeed;     // m/s
    public float windDirection; // degrees
    public float activePower;   // kW
}
