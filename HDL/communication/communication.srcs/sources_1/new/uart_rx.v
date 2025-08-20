module uart_simple_rx #(
    parameter CLK_FREQ = 50000000,  // 50 MHz clock
    parameter BAUD_RATE = 9600
)(
    input wire clk,
    input wire rst,
    input wire rx,  // UART input line
    output reg [7:0] data_out,
    output reg data_valid
);

    localparam integer CLKS_PER_BIT = CLK_FREQ / BAUD_RATE;

    localparam IDLE  = 3'd0;
    localparam START = 3'd1;
    localparam DATA  = 3'd2;
    localparam STOP  = 3'd3;
    localparam CLEANUP = 3'd4;

    reg [2:0] state = IDLE;
    reg [15:0] clk_count = 0;
    reg [2:0] bit_index = 0;
    reg [7:0] rx_shift = 0;

    always @(posedge clk) begin
        if (rst) begin
            state <= IDLE;
            clk_count <= 0;
            bit_index <= 0;
            data_out <= 0;
            data_valid <= 0;
        end else begin
            case (state)
                IDLE: begin
                    data_valid <= 0;
                    if (rx == 0) begin  // Start bit detected
                        state <= START;
                        clk_count <= 0;
                    end
                end

                START: begin
                    if (clk_count == (CLKS_PER_BIT - 1)/2) begin
                        state <= DATA;
                        clk_count <= 0;
                        bit_index <= 0;
                    end else begin
                        clk_count <= clk_count + 1;
                    end
                end

                DATA: begin
                    if (clk_count < CLKS_PER_BIT - 1) begin
                        clk_count <= clk_count + 1;
                    end else begin
                        clk_count <= 0;
                        rx_shift[bit_index] <= rx;
                        if (bit_index < 7) begin
                            bit_index <= bit_index + 1;
                        end else begin
                            bit_index <= 0;
                            state <= STOP;
                        end
                    end
                end

                STOP: begin
                    if (clk_count < CLKS_PER_BIT - 1) begin
                        clk_count <= clk_count + 1;
                    end else begin
                        state <= CLEANUP;
                        clk_count <= 0;
                        data_out <= rx_shift;
                        data_valid <= 1;
                    end
                end

                CLEANUP: begin
                    state <= IDLE;
                    data_valid <= 0;
                end

                default: state <= IDLE;
            endcase
        end
    end

endmodule
