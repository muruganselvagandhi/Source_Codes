module top(
    input clk,          // Clock signal
    input rst_n,        // Active low reset
    input uart_rxd,     // UART RX input from NodeMCU
    output reg led      // LED output
);

wire uart_rx_valid;     // Data valid signal
wire [7:0] uart_rx_data;// Received data

// Instantiate UART Receiver Module
uart_rx i_uart_rx (
    .clk(clk),
    .rst_n(rst_n),
    .uart_rxd(uart_rxd),
    .uart_rx_valid(uart_rx_valid),
    .uart_rx_data(uart_rx_data)
);

// LED Control Logic
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        led <= 1'b0; // Reset LED to OFF
    else if (uart_rx_valid) begin
        if (uart_rx_data == 8'h31) // ASCII '1'
            led <= 1'b1; // Turn LED ON
        else if (uart_rx_data == 8'h30) // ASCII '0'
            led <= 1'b0; // Turn LED OFF
    end
end

endmodule
