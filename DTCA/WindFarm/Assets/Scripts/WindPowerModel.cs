using UnityEngine;

public class WindPowerModel : MonoBehaviour
{
    public WindManager windManager;

    // Sample data (you can add more rows from your CSV)
    // Using Wind Speed (m/s) and Theoretical_Power_Curve (KWh) here.
    [System.Serializable]
    public struct Point
    {
        public float windSpeed;
        public float theoreticalPower; // KWh from your dataset
    }

    public Point[] curve =
    {
        new Point { windSpeed = 5.31133604f, theoreticalPower = 416.3289078f },
        new Point { windSpeed = 5.672166824f, theoreticalPower = 519.9175111f },
        new Point { windSpeed = 5.216036797f, theoreticalPower = 390.9000158f },
        new Point { windSpeed = 5.659674168f, theoreticalPower = 516.127569f },
        new Point { windSpeed = 5.577940941f, theoreticalPower = 491.702972f },
        new Point { windSpeed = 5.793007851f, theoreticalPower = 557.3723633f },
        new Point { windSpeed = 6.199746132f, theoreticalPower = 693.4726411f },
        new Point { windSpeed = 6.378912926f, theoreticalPower = 759.4345366f },
        new Point { windSpeed = 6.446652889f, theoreticalPower = 785.2810099f },
        new Point { windSpeed = 6.415082932f, theoreticalPower = 773.1728635f },
        new Point { windSpeed = 6.89802599f,  theoreticalPower = 970.7366269f },
        new Point { windSpeed = 7.60971117f,  theoreticalPower = 1315.048928f },
        // ...add more rows as needed
    };

    public float currentTheoreticalPower; // for inspector/debug

    // How often to log (seconds)
    public float logInterval = 10f;
    float _timer;

    void Start()
    {
        if (windManager == null)
            windManager = FindAnyObjectByType<WindManager>();

        // Sort curve by windSpeed just in case
        System.Array.Sort(curve, (a, b) => a.windSpeed.CompareTo(b.windSpeed));
    }

    void Update()
    {
        if (windManager == null || curve == null || curve.Length == 0) return;

        float ws = windManager.windSpeed;  // from WindManager
        currentTheoreticalPower = EvaluatePower(ws);

        _timer += Time.deltaTime;
        if (_timer >= logInterval)
        {
            _timer = 0f;
            Debug.Log($"Wind {ws:F2} m/s -> Theoretical power ≈ {currentTheoreticalPower:F2} KWh");
        }
    }

    float EvaluatePower(float windSpeed)
    {
        if (curve.Length == 1) return curve[0].theoreticalPower;

        // clamp below first / above last
        if (windSpeed <= curve[0].windSpeed)
            return curve[0].theoreticalPower;

        if (windSpeed >= curve[curve.Length - 1].windSpeed)
            return curve[curve.Length - 1].theoreticalPower;

        // find neighbouring points
        for (int i = 0; i < curve.Length - 1; ++i)
        {
            var a = curve[i];
            var b = curve[i + 1];

            if (windSpeed >= a.windSpeed && windSpeed <= b.windSpeed)
            {
                float t = Mathf.InverseLerp(a.windSpeed, b.windSpeed, windSpeed);
                return Mathf.Lerp(a.theoreticalPower, b.theoreticalPower, t);
            }
        }

        // fallback
        return curve[curve.Length - 1].theoreticalPower;
    }
}
