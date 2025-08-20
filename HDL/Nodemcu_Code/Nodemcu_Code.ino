#include <ModbusMaster.h>
#include <SoftwareSerial.h>

// PZEM UART pins (D5 = GPIO14 = RX, D6 = GPIO12 = TX)
SoftwareSerial pzem(D5, D6);
ModbusMaster node;

int U_PR = 0, I_PR = 0;
int PF_PR = 98; // Set default power factor (0.98)

void setup() {
  Serial.begin(9600);     // UART to FPGA
  pzem.begin(9600);       // PZEM Serial
  node.begin(1, pzem);    // PZEM Modbus ID = 1
  delay(1000);
}

void loop() {
  uint8_t result = node.readInputRegisters(0x0000, 10);

  if (result == node.ku8MBSuccess) {
    // Get scaled integer values
    U_PR = node.getResponseBuffer(0x00);           // Voltage * 10
    I_PR = node.getResponseBuffer(0x01);           // Current * 1000
    I_PR = I_PR / 10;                              // Scale to Current * 100

    // Send: voltage,current,pf (integers only)
    Serial.print(U_PR);
    Serial.print(",");
    Serial.print(I_PR);
    Serial.print(",");
    Serial.println(PF_PR);
  } else {
    Serial.println("0,0,0"); // In case of error
  }

  delay(1000); // 1s interval
}
