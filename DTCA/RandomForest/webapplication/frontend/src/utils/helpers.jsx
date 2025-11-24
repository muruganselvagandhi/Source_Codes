export const predictPower = (ws) => ws < 3 || ws > 25 ? 0 : Math.max(0, Math.min(-0.5 * Math.pow(ws - 12, 2) + 3200, 3500));

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const parseDate = (dateStr) => {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (!isNaN(d) && d.getFullYear() > 2000) return d;
  const p = dateStr.trim().split(/[\s/:]+/);
  if (p.length >= 4) {
    const [day, month, year, hour, min] = [parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]), parseInt(p[3])||0, parseInt(p[4])||0];
    if (year >= 2000 && month >= 0 && month <= 11 && day >= 1 && day <= 31) return new Date(year, month, day, hour, min);
  }
  return null;
};

export const generateSampleData = () => {
  const data = [];
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= 28; d++) {
      for (let h = 0; h < 24; h++) {
        const bw = 6 + Math.sin(m/12*Math.PI*2)*3 + Math.sin(h/24*Math.PI*2)*2;
        const ws = Math.max(0, bw + (Math.random()-0.5)*4);
        data.push({
          'Date/Time': `${d} ${m+1} 2018 ${h}:00`,
          'Wind Speed (m/s)': ws.toFixed(2),
          'LV ActivePower (kW)': (predictPower(ws)*(0.8+Math.random()*0.4)).toFixed(2),
          _parsedDate: new Date(2018, m, d, h)
        });
      }
    }
  }
  return data;
};
