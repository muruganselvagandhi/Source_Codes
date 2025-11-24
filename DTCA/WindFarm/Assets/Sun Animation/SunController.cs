using UnityEngine;

public class SunController : MonoBehaviour
{
    public CsvPlaybackManager csv;

    void Update()
    {
        transform.Rotate(Vector3.right * (360/csv.secondsPerDay) * Time.deltaTime);
    }
}
