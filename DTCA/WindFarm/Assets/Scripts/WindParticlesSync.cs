using UnityEngine;

public class WindParticlesSync : MonoBehaviour
{
    public WindZone windZone;
    public ParticleSystem ps;

    void Start()
    {
        if (windZone == null)
            windZone = FindAnyObjectByType<WindZone>();

        if (ps == null)
            ps = GetComponent<ParticleSystem>();
    }

    void Update()
    {
        if (windZone == null) return;

        // Set particle velocity based on wind
        var main = ps.main;
        main.startSpeed = windZone.windMain * 5f;

        // Rotate particle emitter to match wind direction
        transform.rotation = Quaternion.Euler(0f, windZone.transform.eulerAngles.y, 0f);
    }
}
