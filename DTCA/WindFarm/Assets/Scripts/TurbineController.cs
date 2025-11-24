using UnityEngine;

public class TurbineController : MonoBehaviour
{
    public WindZone windZone;
    public Transform yawTransform;     // assign your "Yaw" object
    public Transform bladesTransform;  // assign "Blades" under Yaw

    public float yawSmooth = 1.5f;
    public float yawOffsetDegrees = 180f;

    public float rpmMultiplier = 30f;
    private float displayedRPM = 0f;

    void Start()
    {
        if (windZone == null) windZone = FindAnyObjectByType<WindZone>();
        if (yawTransform == null) yawTransform = transform.Find("Yaw");
        if (bladesTransform == null && yawTransform != null)
            bladesTransform = yawTransform.Find("Blades");
    }

    void Update()
    {
        if (windZone == null || yawTransform == null || bladesTransform == null) return;

        // --- YAW ---
        float windDir = windZone.transform.eulerAngles.y + yawOffsetDegrees;
        Quaternion targetYaw = Quaternion.Euler(0f, windDir, 0f);
        yawTransform.rotation = Quaternion.Slerp(
            yawTransform.rotation,
            targetYaw,
            Time.deltaTime * yawSmooth
        );

        // --- RPM mapping (from previous answer) ---
        float windSpeed = windZone.windMain;
        float minSpinWind = 4.5f;
        float maxSpinWind = 25f;
        float rpmAt1 = 1f * rpmMultiplier;
        float rpmAt7 = 7f * rpmMultiplier;
        float rpm;

        if (windSpeed <= minSpinWind)
        {
            rpm = 0f;
        }
        else
        {
            float ws = Mathf.Clamp(windSpeed, minSpinWind, maxSpinWind);
            float t = Mathf.InverseLerp(minSpinWind, maxSpinWind, ws);
            rpm = Mathf.Lerp(rpmAt1, rpmAt7, t);
        }

        displayedRPM = Mathf.Lerp(displayedRPM, rpm, Time.deltaTime * 3f);
        float degPerSec = displayedRPM * 6f;

        bladesTransform.Rotate(Vector3.forward, degPerSec * Time.deltaTime, Space.Self);
    }
}
