module uart_receiver (
    input clk,
    input rst,
    input rx,
    output reg [7:0] volt,
    output reg [7:0] current,
    output reg [7:0] pf,
    output reg [15:0] calc_power,
    output reg [31:0] est_energy
);

    wire [7:0] data;
    wire data_ready;

    uart_simple_rx uart (
        .clk(clk),
        .rst(rst),
        .rx(rx),
        .data_out(data),
        .data_valid(data_ready)
    );

    reg [1:0] byte_counter = 0;

    always @(posedge clk or posedge rst) begin
        if (rst) begin
            byte_counter <= 0;
            volt <= 0;
            current <= 0;
            pf <= 0;
            calc_power <= 0;
            est_energy <= 0;
        end else if (data_ready) begin
            case (byte_counter)
                0: begin
                    volt <= data;
                    byte_counter <= 1;
                end
                1: begin
                    current <= data;
                    byte_counter <= 2;
                end
                2: begin
                    pf <= data;
                    byte_counter <= 0;

                    // Perform calculations
                    calc_power <= volt * current * pf / 100;
                    est_energy <= est_energy + ((volt * current * pf / 100) / 3600);
                end
            endcase
        end
    end

endmodule