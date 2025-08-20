from mpu6050 import mpu6050
import time
import serial

sensor = mpu6050(0x68)

# --- GPS Serial Setup ---
gps_serial = serial.Serial("/dev/serial0", baudrate=9600, timeout=1)

# --- Calibration ---
def calibrate_sensor(samples=100):
    print("Calibrating... Keep the car still.")
    accel_sum = {'x': 0, 'y': 0, 'z': 0}
    for _ in range(samples):
        accel = sensor.get_accel_data()
        for axis in ['x', 'y', 'z']:
            accel_sum[axis] += accel[axis]
        time.sleep(0.01)
    accel_offset = {axis: accel_sum[axis] / samples for axis in accel_sum}
    print("Calibration done. Offset:", accel_offset)
    return accel_offset

# --- Flip Detection ---
def is_flipped(accel_data, offset, flip_threshold=-0.1):
    # Calibrated Z-axis value
    z = accel_data['z'] - offset['z']
    # If Z value is below the threshold, the car is considered flipped
    if z < flip_threshold:
        return True
    return False

# --- Get One GPS Sentence ---
def read_one_gps_sentence():
    while True:
        line = gps_serial.readline().decode('utf-8', errors='ignore').strip()
        if line.startswith('$GPRMC') or line.startswith('$GPGGA'):
            # Check if GPS fix is valid (A indicates valid fix, V means invalid fix)
            if 'A' in line:
                return line
            else:
                print("Waiting for valid GPS fix...")

# --- Main ---
print("Starting calibration...")
accel_offset = calibrate_sensor()
flipped_triggered = False

try:
    while True:
        accel = sensor.get_accel_data()
        
        if is_flipped(accel, accel_offset):
            if not flipped_triggered:  # If flip was not previously detected
                print(" Car Flipped! Z =", accel['z'])
                print(" Getting GPS fix...")
                gps_data = read_one_gps_sentence()
                print(" GPS:", gps_data)
                flipped_triggered = True  # Mark that GPS has been printed after flip

        else:
            print(" Car OK. Z =", accel['z'])
            flipped_triggered = False  # Reset when car is in a normal position

        time.sleep(0.5)

except KeyboardInterrupt:
    print("Stopped.")
