import RPi.GPIO as GPIO
import time

PUMP_PIN = 16

GPIO.setmode(GPIO.BCM)
GPIO.setup(PUMP_PIN, GPIO.OUT)

print("Turning ON pump")
GPIO.output(PUMP_PIN, GPIO.HIGH)
time.sleep(7)
print("Turning OFF pump")
GPIO.output(PUMP_PIN, GPIO.LOW)

GPIO.cleanup()
