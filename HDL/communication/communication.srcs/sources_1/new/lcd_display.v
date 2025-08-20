module lcd_display (
    input clk,
    input rst,
    input [7:0] volt,
    input [7:0] current,
    input [15:0] calc_power,
    input [31:0] est_energy,
    output reg [7:0] lcd_data,
    output reg lcd_enable
);

    reg [3:0] state;
    reg [7:0] buffer [0:31];
    reg [5:0] index;

    function [7:0] ascii(input [3:0] bin);
        ascii = (bin < 10) ? (bin + 8'd48) : (bin + 8'd55);
    endfunction

    always @(posedge clk or posedge rst) begin
        if (rst) begin
            state <= 0;
            index <= 0;
            lcd_enable <= 0;
        end else begin
            case (state)
                0: begin
                    buffer[0] <= "V"; buffer[1] <= ":";
                    buffer[2] <= ascii(volt/100);
                    buffer[3] <= ascii((volt/10)%10);
                    buffer[4] <= ascii(volt%10);
                    buffer[5] <= " ";
                    buffer[6] <= "I"; buffer[7] <= ":";
                    buffer[8] <= ascii(current/100);
                    buffer[9] <= ascii((current/10)%10);
                    buffer[10] <= ascii(current%10);
                    buffer[11] <= " ";

                    buffer[12] <= "P"; buffer[13] <= ":";
                    buffer[14] <= ascii(calc_power/1000);
                    buffer[15] <= ascii((calc_power/100)%10);
                    buffer[16] <= ascii((calc_power/10)%10);
                    buffer[17] <= ascii(calc_power%10);
                    buffer[18] <= " ";

                    buffer[19] <= "E"; buffer[20] <= ":";
                    buffer[21] <= ascii(est_energy/1000);
                    buffer[22] <= ascii((est_energy/100)%10);
                    buffer[23] <= ascii((est_energy/10)%10);
                    buffer[24] <= ascii(est_energy%10);

                    state <= 1;
                    index <= 0;
                end
                1: begin
                    lcd_data <= buffer[index];
                    lcd_enable <= 1;
                    state <= 2;
                end
                2: begin
                    lcd_enable <= 0;
                    index <= index + 1;
                    if (index >= 25) begin
                        state <= 0;
                    end else begin
                        state <= 1;
                    end
                end
            endcase
        end
    end
endmodule
