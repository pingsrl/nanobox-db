const { Command, flags } = require('@oclif/command');
const { exec } = require('child_process');
const { read } = require('node-yaml');

class DbCommand extends Command {
	async run() {
		const { flags } = this.parse(DbCommand);
		const env = await this.getEnv(flags.env);
		if (env) {
			const dbType = await this.getDBType();
			const cmd = `open ${dbType}://${env.user}:${env.pass}@${
				env.host
			}/gonano`;
			this.log(`running ${cmd}`);
			this.execute(cmd);
		}
	}

	async getEnv(env = 'local') {
		let nanobox_output = await this.execute(`nanobox info ${env}`);
		return this.parseEnv(nanobox_output);
	}

	parseEnv(nanobox_output) {
		if (nanobox_output.indexOf('Whoops,') !== -1) {
			this.log(nanobox_output);
			return;
		}
		const lines = nanobox_output.split('\n');

		const user = this.searchInOutput(lines, 'DATA_DB_USER');
		const host = this.searchInOutput(lines, 'DATA_DB_HOST');
		const pass = this.searchInOutput(lines, 'DATA_DB_PASS');

		return {
			user,
			host,
			pass
		};
	}

	searchInOutput(lines, variable) {
		let line = lines.filter(l => l.indexOf(variable + ' ') !== -1).pop();
		if (!line) {
			return;
		}
		return line
			.split(' = ')
			.pop()
			.trim();
	}

	async getDBType() {
		const boxfile = await this.parseBoxFile();
		const data_image = boxfile['data.db'].image;
		if (data_image.indexOf('mysql') !== -1) {
			return 'mysql';
		} else if (data_image.indexOf('postgres') !== -1) {
			return 'postgres';
		}
	}

	async parseBoxFile() {
		const path = process.cwd() + '/boxfile.yml';
		return new Promise((success, fail) => {
			read(path, (err, data) => {
				if (err) {
					fail(err);
				} else {
					success(data);
				}
			});
		});
	}

	execute(command) {
		return new Promise(callback => {
			exec(command, function(error, stdout, stderr) {
				callback(stdout);
			});
		});
	}
}

DbCommand.description = `Open the database of the current nanobox project in your favorite IDE`;

DbCommand.flags = {
	// add --version flag to show CLI version
	version: flags.version({ char: 'v' }),
	// add --help flag to show CLI version
	help: flags.help({ char: 'h' }),
	env: flags.string({ char: 'e', description: 'name to print' })
};

module.exports = DbCommand;
