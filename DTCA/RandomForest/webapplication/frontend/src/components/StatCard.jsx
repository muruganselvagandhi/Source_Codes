import React from 'react';

const StatCard = ({ icon: Icon, title, value, unit, color }) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer">
    <div className={`p-3 rounded-xl ${color} w-fit shadow-lg`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <p className="text-gray-400 text-sm mt-4 font-medium">{title}</p>
    <p className="text-2xl font-bold text-white mt-2">
      {value}
      <span className="text-sm text-gray-400 ml-2 font-normal">{unit}</span>
    </p>
  </div>
);

export default StatCard;
