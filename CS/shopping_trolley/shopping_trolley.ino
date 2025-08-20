#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>
#include "HX711.h" 

#define DOUT A0
#define CLK A1
HX711 scale;             //Create HX711 instance
 
#define SS_PIN 10
#define RST_PIN 9
MFRC522 mfrc522(SS_PIN, RST_PIN);   // Create MFRC522 instance.

LiquidCrystal_I2C lcd(0X27, 16, 2);

int buzzerpin=7;              //Buzzer is connected to digital pin 7 of Arduino UNO
int green1pin=2;               //Green LED is connected to digital pin 2 of Arduino UNO
int green2pin=3;                 //Red LED is connected to digital pin 3 of Arduino UNO
int buttonpin=5;              //Push Button is connected to digital pin 5 of Arduino UNO

int a=0;                      //to check if its master card or not
int b1=0;                     //to track inserting or removing of 1st item
int b2=0;                     //to track inserting or removing of 2nd item
int b3=0;                     //to track inserting or removing of 3rd item
int b4=0;                     //to track inserting or removing of 4th item
int total=0;                  //to store total amount of items purpased by the customer.
int balance_amt=40;         //Balance amount in the master card of the customer.
int buttonstate=0;            //variable for reading the pushbutton status

float w;                      //to store weight measured from HX711 load amplifier
float tot_weight=0.0;         //to store total calculated weight of items detected.
float item_weight=0.0;        //to store weight of each item.
float calibration_factor = 439520; 
 
void setup() 
{
    Serial.begin(9600);         //Initiate a serial communication
    SPI.begin();                //Initiate SPI bus
    mfrc522.PCD_Init();         //Initiate MFRC522
    lcd.begin(16,2);                //Initiate LCD 
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);

    lcd.setCursor(0,0);     
    lcd.println("  WELCOME TO  ");
    lcd.setCursor(0,1);
    lcd.println("SMART SHOPPING");
    delay(1000);
    Serial.println("WELCOME TO SMART SHOPPING");
    Serial.println();
    Serial.println("Insert Master Card");
    Serial.println();
    pinMode(buzzerpin,OUTPUT);  //Setup buzzer
    digitalWrite(buzzerpin,LOW);
    pinMode(green1pin,OUTPUT);   //Setup Green LED
    pinMode(green2pin,OUTPUT);     //Setup Red LED
    pinMode(buttonpin,INPUT);    //Setup push button
    scale.begin(DOUT, CLK);
    scale.set_scale(439520);    //Calibration Factor obtained after Calibration
    scale.tare();               //To set the value to zero
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("INSERT MASTER");
    lcd.setCursor(0,1);
    lcd.print("    CARD     ");
}
void loop() 
{
  buttonstate=digitalRead(buttonpin);
    // Look for new cards
    if ( ! mfrc522.PICC_IsNewCardPresent()) 
    {
        return;
    }
    // Select one of the cards
    if ( ! mfrc522.PICC_ReadCardSerial()) 
    {
        return;
    } 
    String content= "";                                                        //to store UID od RFID tags
    for (byte i = 0; i < mfrc522.uid.size; i++) 
    {
        content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " "));    //extract UID from data blocks of RFID tags 
        content.concat(String(mfrc522.uid.uidByte[i], HEX));                   //convert UID to hexadecimal values
    }
    content.toUpperCase();                                                     //convert hexadecimal UID to uppercase
    if (content.substring(1) == "93 B5 A0 A7" && a==0)                         //to check if user checks in with his master card
    { 
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Name:Hrishikesh");                                               //print customer data
        lcd.setCursor(0,1);
        lcd.print("Balance=");                                                 //print customers balance amount in the master card
        lcd.setCursor(8,1);
        lcd.print(balance_amt);
        Serial.println("Name : Ram");
        Serial.println("Balance=");
        Serial.print(balance_amt);
        Serial.println();
        a=1;                                                                    //to indicate master card is detected 
        delay(3000);
    }
    else if(content.substring(1) == "B3 57 16 11" && a==1 && b1==0)             //to check if item is added
    {
        Serial.println("Box Added");
        Serial.println("Price = Rs.100");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Box added");                                                 //to print details of added item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.100");
        delay(1000);
        item_weight=0.180;
        total=total+100;                                                        //adding item price to total amount
        b1=1;                                                                   //to indicate item is added
        delay(3000);
        tot_weight+=item_weight;                                                //adding item's weight to total weight
    }
    else if(content.substring(1) == "B3 57 16 11" && a==1 && b1==1)             //to check if item is removed
    {
        Serial.println("Box Removed");
        Serial.println("Price = Rs.100");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Box removed");                                              //to print details of removed item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.100");
        delay(1000);
        item_weight=0.180;
        total=total-100;                                                       //subtracting item price from total amount
        b1=0;                                                                  //to indicate item is removed
        delay(3000);
        tot_weight-=item_weight;                                               //subtracting item's weight from total weight
    }
    else if(content.substring(1) == "C3 F2 88 A7" && b2==0 && a==1)            //to check if item is added
    {
        Serial.println("Soap Added");
        Serial.println("Price = Rs.50");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Soap added");                                                //to print details of added item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.50");
        delay(1000);
        item_weight=0.075;
        total=total+50;                                                         //adding item price to total amount
        b2=1;                                                                   //to indicate item is added
        delay(3000);
        tot_weight+=item_weight;                                                //adding item's weight to total weight
    }
    else if(content.substring(1) == "C3 F2 88 A7" && b2==1 && a==1)             //to check if item is removed
    {
        Serial.println("Soap Removed");
        Serial.println("Price = Rs.50");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Soap removed");                                              //to print details of removed item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.50");
        delay(1000);
        item_weight=0.075;
        total=total-50;                                                        //subtracting item price from total amount
        b2=0;                                                                   //to indicate item is removed
        delay(3000);
        tot_weight-=item_weight;                                                //subtracting item's weight from total weight
    }
    else if(content.substring(1) == "02 04 C9 55" && a==1 && b3==0)                       //to check if item is added
    {
        Serial.println("Detergent Soap Added");
        Serial.println("Price = Rs.10");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Detergent Soap added");                                           //to print details of added item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.10");
        delay(1000);
        item_weight=0.079;
        total=total+10;                                                        //adding item price to total amount
        b3=1;                                                                   //to indicate item is added
        delay(3000);
        tot_weight+=item_weight;                                                //adding item's weight to total weight
    }
    else if(content.substring(1) == "02 04 C9 55" && a==1 && b3==1)                       //to check if item is removed
    {
        Serial.println("Detergent Soap Removed");
        Serial.println("Price = Rs.10");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Detergent Soap removed");                                              //to print details of removed item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.10");
        delay(1000);
        item_weight=0.079;
        total=total-10;                                                        //subtracting item price from total amount
        b3=0;                                                                   //to indicate item is removed
        delay(3000);
        tot_weight-=item_weight;                                                //subtracting item's weight from total weight
    }
    else if(content.substring(1) == "30 56 70 59" && a==1 && b4==0)                       //to check if item is added
    {
        Serial.println("Chocolate Added");
        Serial.println("Price = Rs.10");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Chocolate added");                                                 //to print details of added item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.10");
        delay(1000);
        item_weight=0.010;
        total=total+10;                                                        //adding item price to total amount
        b4=1;                                                                   //to indicate item is added
        delay(3000);
        tot_weight+=item_weight;                                                //adding item's weight to total weight
    }
    else if(content.substring(1) == "30 56 70 59" && a==1 && b4==1)                       //to check if item is removed
    {
        Serial.println("Chocolate Removed");
        Serial.println("Price = Rs.10");
        Serial.println();
        Serial.println();
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Chocolate removed");                                              //to print details of removed item
        lcd.setCursor(0,1);
        lcd.print("Price=Rs.10");
        delay(1000);
        item_weight=0.010;
        total=total-10;                                                        //subtracting item price from total amount
        b4=0;                                                                   //to indicate item is removed
        delay(3000);
        tot_weight-=item_weight;                                                //subtracting item's weight from total weight
    }
    else                                                                        //if first card detected is not the master card
    {
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Insert master");
        lcd.setCursor(0,1);
        lcd.print("card");
        Serial.println("Insert master card"); 
        Serial.println();                                                       //tell the customer to insert master card
        Serial.println();
        delay(3000);
    }
    w=scale.get_units(),3;                                                      //taking input from HX711 load amplifier
    Serial.println("Weight of cart: ");
    Serial.print(scale.get_units(), 3); //Up to 3 decimal points                //Print weight of the cart
    Serial.println(" kg");
    Serial.println();    
    Serial.println(); 

    if(content.substring(1) != "93 B5 A0 A7")
    {
        if((w<=(tot_weight+0.015)) && (w>=(tot_weight-0.015)))            //to check if calculated weight is equal to measured weight with an error of +/- 10g
        {
            Serial.println("Weight matched");                                       //if weight is matched green LED starts to glow
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print("Weight matched");
            lcd.setCursor(0,1);
            lcd.print("Total=");
            lcd.setCursor(6,1);
            lcd.print(total);
            Serial.println("Total:");
            Serial.print(total);
            digitalWrite(green1pin,HIGH);
            delay(1000);
            digitalWrite(green1pin,LOW);
            Serial.println();
            Serial.println();    
            Serial.println("Continue");
        }
        else
        {
            Serial.println("Weight not matched");                                   //if weight is not matched red LED starts to glow
            Serial.println();    
            Serial.println();    
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print("Weight not");
            lcd.setCursor(0,1);
            lcd.print(" matched  ");
            digitalWrite(green2pin,HIGH);
            digitalWrite(buzzerpin,HIGH);                                           //buzzer sound indicates malpractice
            delay(1000);
            digitalWrite(buzzerpin,LOW);
            delay(2000);
            digitalWrite(green2pin,LOW);
        }
    }
 
    // buttonstate=digitalRead(buttonpin);   
    Serial.println(buttonstate);                                      //Read the state of pushbutton 
    if(buttonstate==1)                                                       //Check if push Button is pressed.
    {
      Serial.println("Button pressed");
        if(total<=balance_amt)                                                  //Check if customer has enough balance in master card
        {
            balance_amt-=total;                                                 //Sutracting the total amount from the balance
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print("THANKS FOR");
            lcd.setCursor(0,1);
            lcd.print(" SHOPPING ");
            Serial.println("THANKS FOR SHOPPING");
            Serial.println();    
            Serial.println();    
            delay(3000);
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print("Total Bill =");
            lcd.setCursor(0,1);
            lcd.print(total); 
            delay(3000);
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print("Balance =");
            lcd.setCursor(0,1);
            lcd.print(balance_amt);                                           //Printing the balance amount for customer's reference
            Serial.println("TOTAL BILL AMOUNT = ");
            Serial.print(total);
            Serial.println();    
            Serial.println();    
            Serial.println("BALANCE AMOUNT = ");
            Serial.print(balance_amt);
            Serial.println();    
            Serial.println();    
        }
        else
        {
            lcd.clear();
            lcd.setCursor(0,0);
            lcd.print("INSUFFICIENT");
            lcd.setCursor(0,1);
            lcd.print("  BALANCE   ");
            Serial.println("INSUFFICIENT BALANCE");
            Serial.println();    
            Serial.println();   
            digitalWrite(green2pin,HIGH);
            digitalWrite(buzzerpin,HIGH);                                           //buzzer sound indicates malpractice
            delay(1000);
            digitalWrite(buzzerpin,LOW);
            delay(2000);
            digitalWrite(green2pin,LOW); 
            delay(3000);
        }
    }
    
}
