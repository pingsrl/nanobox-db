const { Command, flags } = require("@oclif/command");
const { exec, spawn } = require("child_process");
const { read } = require("node-yaml");

class DbCommand extends Command {
	async run() {
		const { flags } = this.parse(DbCommand);
		const env = await this.getEnv(flags.env, flags.component);

		if (flags.env !== "local") {
			try {
				let tunnel = await this.openTunnel(flags.env);
				env.host = "127.0.0.1:5444";
			} catch (e) {
				this.log(`Error opening tunnel: ${e}`);
				return;
			}
		}
		if (env) {
			const dbType = await this.getDBType();
			const cmd = `open ${dbType}://${env.user}:${env.pass}@${env.host}/gonano`;
			this.log(`running ${cmd}`);
			this.execute(cmd);
		}
	}

	async getEnv(env, data_component) {
		let nanobox_output = await this.execute(`nanobox evar ls ${env}`);
		return this.parseEnv(nanobox_output, data_component);
	}

	async openTunnel(env = "default") {
		let ouput = await this.spawn("nanobox", [
			"tunnel",
			env,
			"data.db",
			"-p",
			"5444",
		]);
		if (ouput.indexOf("Error") === -1) {
			return false;
		}
		return true;
	}

	parseEnv(nanobox_output, data_component) {
		if (nanobox_output.indexOf("Whoops,") !== -1) {
			this.log(nanobox_output);
			return;
		}
		const lines = nanobox_output.split("\n");

		const user = this.searchInOutput(
			lines,
			`DATA_${data_component.toUpperCase()}_USER`
		);
		const host = this.searchInOutput(
			lines,
			`DATA_${data_component.toUpperCase()}_HOST`
		);
		const pass = this.searchInOutput(
			lines,
			`DATA_${data_component.toUpperCase()}_PASS`
		);

		if (!user || !host || !pass) {
			return false;
		}

		return {
			user,
			host,
			pass,
		};
	}

	searchInOutput(lines, variable) {
		let line = lines.filter((l) => l.indexOf(variable + " ") !== -1).pop();
		if (!line) {
			return;
		}
		return line.split(" = ").pop().trim();
	}

	async getDBType() {
		const boxfile = await this.parseBoxFile();
		const data_image = boxfile["data.db"].image;
		if (data_image.indexOf("mysql") !== -1) {
			return "mysql";
		} else if (data_image.indexOf("postgres") !== -1) {
			return "postgres";
		}
	}

	async parseBoxFile() {
		const path = process.cwd() + "/boxfile.yml";
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
		return new Promise((ok, fail) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					fail(error);
				} else {
					ok(stdout);
				}
			});
		});
	}

	spawn(command, args) {
		return new Promise((ok, fail) => {
			let cmd = spawn(command, args);

			cmd.stdout.on("data", (data) => {
				ok(data);
			});

			cmd.stderr.on("data", (data) => {
				if (data.indexOf("ADDRESS IN USE") != -1) {
					fail("PORT 5444 IN USE");
				} else if (data.indexOf("+ Secure tunnel established to") != -1) {
					ok(data);
				}
			});
		});
	}
}

DbCommand.description = `Open the database of the current nanobox project in your favorite IDE`;

DbCommand.flags = {
	// add --version flag to show CLI version
	version: flags.version({ char: "v" }),
	// add --help flag to show CLI version
	help: flags.help({ char: "h" }),
	env: flags.string({
		char: "e",
		description: "the environment to use",
		default: "local",
	}),
	component: flags.string({
		char: "c",
		description: "the data component to connect to",
		default: "db",
	}),
};

module.exports = DbCommand;
