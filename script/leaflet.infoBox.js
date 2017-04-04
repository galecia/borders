L.Control.InfoBox = L.Control.extend({
	options: {
		title: 'County Info',
		position: 'bottomleft'
	},

	onAdd: function () {
		this._div = L.DomUtil.create('div', 'border-info-box');

		var contents = []
		var nameLabel = L.DomUtil.create('h4', '');
		nameLabel.textContent = 'County/Region:';
		var datesLabel = L.DomUtil.create('h4', '');
		datesLabel.textContent = 'Effective Dates:';
		var changeLabel = L.DomUtil.create('h4', '');
		changeLabel.textContent = 'Description of Border Change:';

		contents.push(nameLabel, L.DomUtil.create('p', 'name'), L.DomUtil.create('br', ''),
			  datesLabel, L.DomUtil.create('p', 'dates'), L.DomUtil.create('br', ''),
			  changeLabel, L.DomUtil.create('p', 'change'));

		contents.forEach(function (el) {
		  this._div.appendChild(el);
		}.bind(this));

		this.update();

		return this._div;
	},

	update: function (data) {
		var info = $(this._div);

		if (!data) {
			info.children('.name').text('');
			info.children('.dates').text('');
			info.children('.change').text('No region selected.');
		} else {
			if (info.children('.name').text() !== data.fullName) {
				var startDate = new Date(data.dates.start),
					start = startDate.toDateString(),
					endDate = new Date(data.dates.end),
					end = endDate.toDateString();

				info.addClass('active');
				setTimeout(function() {
					info.removeClass('active');
				}, 200);

				info.children('.name').text(data.fullName);
				info.children('.dates').text(start + ' - ' + end);
				info.children('.change').text(data.change);
			}
		}
	}
});

L.infoBox = function(options) {
	return new L.Control.InfoBox(options);
};

