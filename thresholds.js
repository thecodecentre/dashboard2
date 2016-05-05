// global namespace
var NF = NF || {
	
	thresholds: {
		
		// ACT thresholds
		ACT: {
			green: 0,
			amber: 1800,
			red: 2100
		},
		
		// ASA thresholds
		ASA: {
			green: 0,
			amber: 90,
			red: 99
		},
		
		// SL thresholds
		SL: {
			green: 90,
			amber: 85,
			red: 0
		},
		
		// Concurrency thresholds
		Concurrency: {
			green: 1.60,
			amber: 1.52,
			red: 0.00
		},
		
		// Answered thresholds
		Answered: {
			green: 97,
			amber: 92,
			red: 0
		},
		
		// Unanswered thresholds
		Unanswered: {
			green: 0,
			amber: 5,
			red: 10
		}
	}
};

