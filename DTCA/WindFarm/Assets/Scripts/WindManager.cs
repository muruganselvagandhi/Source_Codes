using UnityEngine;

public class WindManager : MonoBehaviour
{
    [Header("Mode")]
    public bool manualMode = false; // if true → manual inspector values override CSV

    [Header("Wind Settings")]
    [Range(0f, 30f)]
    public float windSpeed = 5f;

    [Range(0f, 360f)]
    public float windDirection = 0f;

    public WindZone windZone;
    public ParticleSystem windParticles;

    [Header("Particle Settings")]
    public float particleSpeedFactor = 5f;
    public float emissionMax = 300f;

    void Start()
    {
        if (windZone == null)
            windZone = FindAnyObjectByType<WindZone>();

        if (windParticles == null)
            windParticles = FindAnyObjectByType<ParticleSystem>();
    }

    void Update()
    {
        ApplyToWindZone();
        ApplyToParticles();
    }

    public void SetWind(float speed, float direction)
    {
        if (manualMode) return;
        windSpeed = speed;
        windDirection = direction;
    }

    void ApplyToWindZone()
    {
        if (windZone == null) return;

        windZone.windMain = windSpeed;

        var rot = windZone.transform.eulerAngles;
        rot.y = windDirection;
        windZone.transform.eulerAngles = rot;
    }

    void ApplyToParticles()
    {
        if (windParticles == null) return;

        var main = windParticles.main;
        var emission = windParticles.emission;

        windParticles.transform.rotation =
            Quaternion.Euler(0f, windDirection, 0f);

        main.startSpeed = windSpeed * particleSpeedFactor;

        float t = Mathf.Clamp01(windSpeed / 30f);
        emission.rateOverTime = Mathf.Lerp(20, emissionMax, t);
    }
}
