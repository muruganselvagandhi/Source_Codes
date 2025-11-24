using UnityEngine;

public class ComparisonLogger : MonoBehaviour
{
    public CsvPlaybackManager csv;
    public OnnxPowerPredictor predictor;

    void Start()
    {
        if (csv == null) csv = FindAnyObjectByType<CsvPlaybackManager>();
        if (predictor == null) predictor = FindAnyObjectByType<OnnxPowerPredictor>();
    }

    float timer;

    void Update()
    {
        timer += Time.deltaTime;
        if (timer < 1f) return;
        timer = 0f;

        float actual = csv.lastActualPower;
        float pred = predictor.predictedPower;

        Debug.Log($"Wind={csv.lastWindSpeed:F2} m/s | Pred={pred:F1} kW | Actual={actual:F1} kW | Err={pred - actual:F1}");
    }
}
