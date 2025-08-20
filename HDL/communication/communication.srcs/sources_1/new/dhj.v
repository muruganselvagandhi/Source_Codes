module uart_rx
  #(parameter CLKS_PER_BIT = 10416) // For 9600 baud with 100MHz clk
  (
   input        i_Clock,
   input        i_Rx_Serial,
   output reg   o_Rx_DV,
   output reg [7:0] o_Rx_Byte
   );

  localparam IDLE         = 3'b000;
  localparam RX_START_BIT = 3'b001;
  localparam RX_DATA_BITS = 3'b010;
  localparam RX_STOP_BIT  = 3'b011;
  localparam CLEANUP      = 3'b100;

  reg [2:0] r_SM_Main     = 0;
  reg [15:0] r_Clock_Count = 0;
  reg [2:0] r_Bit_Index   = 0;
  reg [7:0] r_Rx_Byte     = 0;
  reg       r_Rx_DV       = 0;

  always @(posedge i_Clock)
  begin
    case (r_SM_Main)
      IDLE :
        begin
          o_Rx_DV       <= 1'b0;
          r_Clock_Count <= 0;
          r_Bit_Index   <= 0;

          if (i_Rx_Serial == 1'b0)
            r_SM_Main <= RX_START_BIT;
          else
            r_SM_Main <= IDLE;
        end

      RX_START_BIT :
        begin
          if (r_Clock_Count == (CLKS_PER_BIT-1)/2)
            begin
              if (i_Rx_Serial == 1'b0)
                begin
                  r_Clock_Count <= 0;
                  r_SM_Main     <= RX_DATA_BITS;
                end
              else
                r_SM_Main <= IDLE;
            end
          else
            begin
              r_Clock_Count <= r_Clock_Count + 1;
              r_SM_Main     <= RX_START_BIT;
            end
        end

      RX_DATA_BITS :
        begin
          if (r_Clock_Count < CLKS_PER_BIT-1)
            begin
              r_Clock_Count <= r_Clock_Count + 1;
              r_SM_Main     <= RX_DATA_BITS;
            end
          else
            begin
              r_Clock_Count          <= 0;
              r_Rx_Byte[r_Bit_Index] <= i_Rx_Serial;

              if (r_Bit_Index < 7)
                begin
                  r_Bit_Index <= r_Bit_Index + 1;
                  r_SM_Main   <= RX_DATA_BITS;
                end
              else
                begin
                  r_Bit_Index <= 0;
                  r_SM_Main   <= RX_STOP_BIT;
                end
            end
        end

      RX_STOP_BIT :
        begin
          if (r_Clock_Count < CLKS_PER_BIT-1)
            begin
              r_Clock_Count <= r_Clock_Count + 1;
              r_SM_Main     <= RX_STOP_BIT;
            end
          else
            begin
              o_Rx_DV       <= 1'b1;
              r_Clock_Count <= 0;
              r_SM_Main     <= CLEANUP;
            end
        end

      CLEANUP :
        begin
          r_SM_Main <= IDLE;
          o_Rx_DV   <= 1'b0;
          o_Rx_Byte <= r_Rx_Byte;
        end

      default :
        r_SM_Main <= IDLE;

    endcase
  end

endmodule
