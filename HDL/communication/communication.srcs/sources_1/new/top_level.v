module uart_power_energy_display (
    input wire clk,
    input wire uart_rx,
    output reg [7:0] lcd_data,
    output reg lcd_e,
    output reg lcd_rs
);

    parameter CLK_FREQ = 50000000;
    parameter BAUD_RATE = 9600;
    localparam BAUD_DIV = CLK_FREQ / BAUD_RATE;
    localparam ENERGY_SCALE = 3600; // Conversion from Ws to Wh

    // UART Receiver (unchanged)
    reg [15:0] baud_cnt = 0;
    reg [3:0] bit_index = 0;
    reg [9:0] shift_reg = 0;
    reg receiving = 0;
    reg [7:0] rx_data = 0;
    reg rx_ready = 0;

    always @(posedge clk) begin
        if (!receiving && uart_rx == 0) begin
            receiving <= 1;
            baud_cnt <= BAUD_DIV / 2;
            bit_index <= 0;
        end else if (receiving) begin
            if (baud_cnt == BAUD_DIV - 1) begin
                baud_cnt <= 0;
                shift_reg[bit_index] <= uart_rx;
                bit_index <= bit_index + 1;
                if (bit_index == 9) begin
                    receiving <= 0;
                    rx_data <= shift_reg[8:1];
                    rx_ready <= 1;
                end
            end else begin
                baud_cnt <= baud_cnt + 1;
            end
        end
        if (rx_ready) rx_ready <= 0;
    end

    assign uart_tx = 1'b1; // Not used

    // UART Buffer (unchanged)
    reg [7:0] buffer[0:31];
    reg [5:0] buf_index = 0;
    reg line_ready = 0;

    always @(posedge clk) begin
        if (rx_ready) begin
            if (rx_data == 8'h0A) begin // newline
                line_ready <= 1;
            end else begin
                buffer[buf_index] <= rx_data;
                buf_index <= buf_index + 1;
            end
        end

        if (line_ready) begin
            buf_index <= 0;
            line_ready <= 0;
        end
    end

    // Parsed values with improved energy calculation
    reg [15:0] voltage = 0, current = 0, pf = 0;
    reg [31:0] power = 0;
    reg [31:0] energy = 0; // Now in 0.001 Wh units (milli-Watt-hours)

    integer i;
    reg [15:0] temp_val = 0;
    reg [1:0] field = 0;

    always @(posedge clk) begin
        if (line_ready) begin
            temp_val = 0;
            field = 0;
            for (i = 0; i < buf_index; i = i + 1) begin
                if (buffer[i] >= "0" && buffer[i] <= "9") begin
                    temp_val = temp_val * 10 + (buffer[i] - "0");
                end else if (buffer[i] == "," || i == buf_index - 1) begin
                    case (field)
                        0: voltage = temp_val;
                        1: current = temp_val;
                        2: pf      = temp_val;
                    endcase
                    temp_val = 0;
                    field = field + 1;
                end
            end
            // Compute power (now in milli-Watts)
             power <= (voltage * current * pf) / 100000; // 1 = 0.001 kW
        end
    end

    // Energy accumulation - now in milli-Watt-hours
    reg [25:0] sec_counter = 0;
    wire one_sec = (sec_counter == CLK_FREQ - 1);

    always @(posedge clk) begin
        if (one_sec) begin
            sec_counter <= 0;
            // Accumulate energy in milli-Watt-hours (power is in milli-Watts)
            // energy <= energy + (power / 3600) would lose precision
            // Instead, we'll accumulate fractional parts:
            energy <= energy + power;
        end else begin
            sec_counter <= sec_counter + 1;
        end
    end

    // LCD Display Data with improved energy display
        // LCD Display Data with simple 4-digit format
    reg [7:0] line1[0:15]; // First line (Power)
    reg [7:0] line2[0:15]; // Second line (Energy)

    task display_value;
        input [31:0] val;
        input [3:0] start;
        input [7:0] line_num;
        begin
            if (line_num == 0) begin
                // Simple 4-digit display for power
                line1[start]   = (val / 1000) % 10 + "0";
                line1[start+1] = (val / 100) % 10 + "0";
                line1[start+2] = (val / 10) % 10 + "0";
                line1[start+3] = val % 10 + "0";
            end else begin
                // Keep original display for energy
                line2[start]   = (val / 1000) % 10 + "0";
                line2[start+1] = (val / 100) % 10 + "0";
                line2[start+2] = (val / 10) % 10 + "0";
                line2[start+3] = val % 10 + "0";
            end
        end
    endtask

    always @(posedge clk) begin
        // First line: Power (W) in 0000 format
        line1[0] = "P"; line1[1] = "=";
        display_value(power, 2, 0); // Show as 0123 W
        line1[6] = " "; line1[7] = "W";
        
        // Second line: Energy (Wh) - unchanged
        line2[0] = "E"; line2[1] = "=";
        display_value(energy / 3600, 2, 1); // Convert accumulated mWs to Wh
        line2[6] = " "; line2[7] = "J";
    end
    // LCD FSM (unchanged)
    reg [3:0] lcd_state = 0;
    reg [4:0] lcd_index = 0;
    reg [15:0] lcd_delay = 0;
    reg lcd_line = 0;

    always @(posedge clk) begin
        lcd_delay <= lcd_delay + 1;
        if (lcd_delay == 50000) begin
            lcd_delay <= 0;
            case (lcd_state)
                0: begin lcd_rs <= 0; lcd_data <= 8'h38; lcd_e <= 1; lcd_state <= 1; end
                1: begin lcd_e <= 0; lcd_state <= 2; end
                2: begin lcd_rs <= 0; lcd_data <= 8'h0C; lcd_e <= 1; lcd_state <= 3; end
                3: begin lcd_e <= 0; lcd_state <= 4; end
                4: begin lcd_rs <= 0; lcd_data <= 8'h01; lcd_e <= 1; lcd_state <= 5; end
                5: begin lcd_e <= 0; lcd_state <= 6; end
                6: begin 
                    lcd_rs <= 0; 
                    lcd_data <= lcd_line ? 8'hC0 : 8'h80;
                    lcd_e <= 1; 
                    lcd_state <= 7; 
                end
                7: begin lcd_e <= 0; lcd_state <= 8; end
                8: begin
                    lcd_rs <= 1;
                    lcd_data <= lcd_line ? line2[lcd_index[3:0]] : line1[lcd_index[3:0]];
                    lcd_e <= 1;
                    lcd_state <= 9;
                end
                9: begin
                    lcd_e <= 0;
                    if (lcd_index < 15) begin
                        lcd_index <= lcd_index + 1;
                        lcd_state <= 8;
                    end else begin
                        lcd_index <= 0;
                        if (lcd_line == 0) begin
                            lcd_line <= 1;
                            lcd_state <= 6;
                        end else begin
                            lcd_line <= 0;
                            lcd_state <= 6;
                        end
                    end
                end
            endcase
        end
    end
endmodule