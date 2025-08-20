module top(
    input clk, // Clock signal
    input rst_n, // Reset signal (active low)
    input uart_rxd, // UART receive pin
   
    output reg led // LED output
);

wire uart_rx_valid; // Data valid signal
wire [7:0] uart_rx_data; // Received data

uart_rx i_uart_rx(
    .clk(clk),
    .rst_n(rst_n),
    .uart_rxd(uart_rxd),
    .uart_rx_valid(uart_rx_valid),
    .uart_rx_data(uart_rx_data)
);

reg [31:0] blink_counter = 32'd0; // Counter for blinking

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        led <= 1'b0; // Reset LED to off
        blink_counter <= 32'd0;
    end else begin
        if (uart_rx_valid && uart_rx_data == 8'd1) begin // Check for specific command to blink
            blink_counter <= blink_counter + 1'b1;
            if (blink_counter >= 100000000) begin // Blink every 2 seconds at 100 MHz clock
                led <= ~led; // Toggle LED
                blink_counter <= 32'd0;
            end
        end
    end
end

endmodule
