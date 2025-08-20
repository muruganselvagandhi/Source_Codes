module uart_receiver (
    input wire clk,
    input wire rst,
    input wire rx,
    output reg [15:0] voltage,
    output reg [15:0] current,
    output reg [15:0] pf,
   
);
    parameter IDLE = 0, RECEIVE = 1;
    reg [2:0] state = IDLE;
    reg [2:0] byte_count = 0;
    reg [7:0] rx_byte;
    reg [47:0] data_buffer;

    // UART protocol parameters
    wire uart_ready;
    wire [7:0] uart_data;
    uart_simple_rx uart (
        .clk(clk),
        .rst(rst),
        .rx(rx),
        ,
        .data(uart_data)
    );

    always @(posedge clk or posedge rst) begin
        if (rst) begin
            voltage <= 0;
            current <= 0;
            pf <= 0;
            state <= IDLE;
            byte_count <= 0;
            data_ready <= 0;
        end else begin
            case (state)
                IDLE: begin
                    if (uart_ready) begin
                        data_buffer[47:40] <= uart_data;
                        byte_count <= 1;
                        state <= RECEIVE;
                    end
                end

                RECEIVE: begin
                    if (uart_ready) begin
                        data_buffer <= {data_buffer[39:0], uart_data};
                        byte_count <= byte_count + 1;
                        if (byte_count == 5) begin
                            voltage <= {data_buffer[47:40], data_buffer[39:32]};
                            current <= {data_buffer[31:24], data_buffer[23:16]};
                            pf      <= {data_buffer[15:8],   data_buffer[7:0]};
                            data_ready <= 1;
                            state <= IDLE;
                        end
                    end
                end
            endcase
        end
    end
endmodule
