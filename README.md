# Shenanibot
The Shenanibot is a free Twitch chatbot developed to help streamers manage a queue of viewer-chosen levels for the Butterscotch Shenanigans game [Levelhead](https://bscotch.net/games/levelhead)

## What does it do?
The bot stores a list of viewer-submitted levelcodes for you to play, and automatically syncs them to your bookmarks directly in LevelHead, so that you don't have to type in the level codes and keep track of them!

## Commands
### Streamer Commands

`!open` : Opens the queue for viewers to submit levels  
`!close` : Closes the queue  
`!permit [user name]` : Allows a user to add one level to the queue even if it is closed or they have reached the submission limit  
`!mark [name]` : Place a marker in the queue.  You can optionally proivde a name for the marker, which will show up when displaying the queue.  See [Using Markers](#using-markers) for details  
`!clear` : remove all levels from the queue  
`!suspend` : close the queue and postpone all levels to the next session.  This command only works if persistence is enabled.  The expected use case is to record the current state of the queue just before shutting down, so that you can pick up where you left off next time.  When levels are reloaded, however, they will not be counted against any viewer's level limit  
`!giveboost [user name]` : Allows a user to use the `!boost` command one time  
`!reward [reward behavior]` : Sets up a channel points reward.  Unlike other commands, this must be sent as the message for a custom channel points reward; it assigns a behavior to that particular custom reward.  See [Channel Points Integration](#channel-points-integration) for details  
`!noreward [reward behavior]` : Removes the assignment of a reward behavior from whatever custom reward currently has that behavior  
`!reset stats` : reset the counts of levels played, won, and lost.  If stat persistence is enabled, then the historical counts are reset along with the current-session counts  
`!players [n]` : change the maximum acceptable "required players" value for levels to be added to the queue.  This will revert to the default the next time you restart the bot (see [Queue Management Options](#queue-management-options))  
`!nope [level code | prev]` : ban a level from future submission to the queue.  This command only works if persistence is enabled.  If you don't give any argument, this bans (and skips) the current "now playing" level.  If you say `!nope prev`, it bans the most recently dequeued level (so you can count the level as played, won, or lost but then ban it from resubmission).  If you give a level code as the argument and the level is in the queue, it wil be removed.  

**Advancing the Queue**  
When you are done with the current "now playing" level, there are several commands you can use to advance the queue (depending on how you want the new "now playing" level chosen and/or how you want level counts updated).

This first group of commands is normally used if you don't want to show win/loss counts:

`!next` : Moves the queue forward a level  
`!random` : Chooses a random level from the queue and puts it at the front of the queue to play.  If there are markers in the queue, a level will be chosen from before the first marker.  If priority rules other than order have been applied to the queue, this command respects them; so the chosen level will always be one of thoes with the highest priority  
`!play` : Move the queue forward, pulling a specified level (by username or queue position) to the front to be played next. You can say, for example, `!play from username` to play the next level submitted by `username`; or `!play last from username` to play the level most recently submitted by `username`; or `!play 5` to play whatever level is at position #5 in the queue. Note that this will override any other priority rule, so it should be used with caution if, for example, channel points have been spent on priority  

If you are using win and loss counts, then any of the above commands will count the level as "played", but not as "won" or "lost" - so it will appear as if you're counting it as a draw.  This next group of commands allow you to control how levels are counted.

For each of these commands, you can specify what level to play next using the "and play" option; but normally you probably won't want to, so if "and play" is omitted, these commands use the "default advance mode" (configured under [Queue Management Options](#queue-management-options)) to determine the new "now playing" level.
  
`!win [and play ...]` : Increases the "won" count  
`!lose [and play ...]` : Increases the "lost" count  

Whether or not you are counting wins and losses, you might want to move past a level without including it in your "played levels" count (as though you had `!remove`d it before it reached the "now playing" position).  In that case you can use 

`!skip [and play ...]` : Moves the queue forward, but does not increment the "played levels" count  

Like `!win` and `!lose`, `!skip` will use the "default advance mode" if the "and play" option is omitted.

If persistence is enabled, you can also use

`!postpone [and play ...]` : Saves the level to be played in the next session  
`!nope [and play ...]` : Skips the level and bans it from future resubmission  

The `!postpone` command works just like `!skip`, except the level will automatically be reloaded into the queue the next time the bot starts up (assuming persistence is still enabled).  Reloaded level(s) are not counted against any player's limit, and in "rotation" mode they are placed in a round before any newly-submitted levels.

The `!nope` command is described in more detail in the previous section, but note that when using it to skip the current level `...and play...` syntax is also accepted.

Finally, if you have set the "default advance mode" to alternate, there may be situations where you want to take advantage of this ability to automatically alternate between `!next` and `!random` even though none of the above commands that do that are applicable.  For example, you may not be counting wins and losses; or you may want to count the level as a draw.  In those cases, you can use

`!advance`: Moves the queue forward.  The "default advance mode" determines which level is moved up to the "now playing" position.  The "played levels" count is incraesed, but the "win" or "loss" counts are not  

**Rewinding the Queue**

If you accidentally advance the queue and then realize you're not really done with the previous level, you can rewind one entry with

`!back`: put the most-recently dequeued level back in the "now playing" position

If dequeuing the level increased the played and/or win/loss counts, they are returned to their previous values.

If the previous level had been postponed, this is also undone; so the level will not be reloaded when the bot restarts.

If the previous level had been banned (see `!nope`), then it is unbanned (as it could not otherwise be put back into the queue).

Only the most recently dequeued level is remembered; so although you can use the command as many times as you want, you can't use it "twice in a row" to go back two levels.

If the prior command pulled a level forward in the queue (e.g. `!random` or `!play`), that level will remain in the "on deck" position.  That is, all levels are pushed back one space; no further attempt is made to restore the queue order prior to the previous level being dequeued.  For this reason, commands that normally use the default advance mode will always move to the next level when dequeueing a level that was readded using `!back`.

If you're using "active" level limits, the restored level does not count against the original submitter's limit.  (This prevents any ambiguity if they had already submitted their next level.)

Any `nospoil` messages for the previous level will have already been sent; so viewers may have to re-issue `nospoil` commands.  If anyone had entered a `nospoil` command for the next level, it will be remembered for later.

### Viewer Commands

`!check [level code | creator code]` : Checks if the streamer has played a level (note that very recent plays may not be reported), or shows the most recent unplayed level for a creator (or most recent unbeaten if all have been played)  
`!add [level code | creator code]` : Adds a level (or creator profile if support is enabled) to the level queue  
`!chadd [level code]` : Checks if the streamer has played a level and, if not, tries to add it to the level queue  
`!remove [level code | creator code]` : Removes a level from the queue, you can only remove your own levels  
`!boost [level code | creator code]` : Marks a level as "high priority" and moves it to the front of the qeuue, as though the `urgent` channel point reward had been applied. This command can be used by the streamer, or with permission from the streamer (see the `giveboost` command)  
`!nospoil` : Request that the bot send you a direct message when the current level is removed from the queue.  This only works when a level is being played (i.e. the queue is not empty and there is not a marker at the top of the queue), and the bot may reject the request if it appears the DM can't be sent (e.g. if the bot has reached a limit on how many users it may DM)  
`!queue` : Shows up to 10 of the next levels in the queue  
`!stats` : Shows level-count stats  
`!commands` or `!help` : Shows some quick commands for viewers  
`!bot` : Shows bot description  

## Want to add or edit commands?
Feel free to fork or clone the bot, and change it however you like. If you want your changes to be put in the main version, simply open a pull reqest and we will review it ASAP


# Bot Setup
**Have any questions?**
You can join the [Butterscotch Shenanigans Discord](https://discord.gg/w55QE5Y) and ask any questions you have!  

## Getting Started
**Materials:**  
+ LevelHead account
+ Streamer Twitch account
+ Bot Twitch account

If you don't know how to program, don't worry. This quick guide will teach everything you need to know to get the bot up and running!

## Installing the Bot

There are two ways to install the bot: using `npm`, or using pre-compiled stand-alone binaries.

If you are comfortable working with a `node.js` environment, then an `npm`-based installation can help automate upgrades.

If you want the absolute simplicity of downloading an `.exe` (or linux or MacOS binary) and just running it, that's also an option.  Be aware that standard security software may ask for more confirmations when running the stand-alone binaries.

### Installing with `npm`

In order to use npm, you will need Node.js, which you can download at https://nodejs.org. Click on the button that says *'Recommended for most users'*. Once it has downloaded, open the file, and a window will pop up to help guide you through the installation. The default settings should work fine.

Once you have node.js installed, open a terminal (`cmd` or `PowerShell`) and enter the command

`npm install --global @madelsberger/shenanibot`

### Using Pre-Compiled Stand-Alone Binaries

From the project's github page, find the "Latest Release" link (toward the top of the page, to the right of the file list).  From the release page, download the appropriate binary for your OS (e.g. for Windows, `shenanibot.exe`).

### Upgrading from a Previous Version

From 2.0.0 onward, you can simply repeat the installation process.  (That is, for an `npm`-based installation, rerun the above install command; or if using stand-alone binary, replace your old binary with a download from the new release.)

Older versions of ShenaniBot (prior to 2.0.0) required you to set up a "bot directory" and stored your configuration in that directory.  ShenaniBot now stores your configuration in your home diretory (e.g. typically "C:\users\\&lt;your_name&gt;" on Windows); so there is no longer a need for a bot directory.

To autotically migrate your configuration from an older version:

+ Open a terminal (`cmd` or `PowerShell`)
+ Navigate (`cd`) to your old bot directory
+ Run the config utility (`shenanibot-config` for `npm`-based installs, or the config binary you downloaded)

The config utility should load with your old configuration settings.  You can review and update config settings, or just immediately exit the config utility.

You only need to do this once.  When you've verified that the new bot is configured correctly, you will be able to safely discard your old bot directory.

Note that this migration process only works if no configuration file is found in your home directory.  If, when you run the config utility, your previous config settings do not appear to be set, it may mean that you need to delete the file `shenanibot-config.json` from your home directory.  (For example, this could happen if you tried to run the new version of the bot before performing the migration process.)

## Configuration
For `npm`-based installs, you can run the configuration utility from any terminal by typing:

`shenanibot-config`

If you downloaded a binary, run it with the `-c` (or `--config`) command-line option.  For example, on windows

`shenanibot.exe -c`

For new installatios, you will need to provide some information that's needed for the bot to interact with Twitch and with LevelHead.

You can also use the configuration utility to change configuration parameters at any time (although a bot restart is required for changes to take effect).

The configuration utility presents a menu with the following options:

### Twitch Streamer Info (required)
Here you set yoru Twitch channel name and username. Normally these will be the same (or will differ only by capitalization, which makes no difference to the bot). The bot connects to the chat for the specified channel and grants streamer access (such as the ability to execute streamer commands) for messages that match the username.

If you also provide an OAuth token for your streamer account, then whispers will be sent from your streamer account rather than from the bot account.  (This may be more reliable due to Twitch anti-spam measures.)  You do not have to enter a streamer OAuth token; in that case, all messages are sent from the bot account.

### Twitch Bot Authentication (required)
The bot needs an account to use when logging into Twitch chat. This account can be shared with other bots, but it should not be your streamer account.

Rather than a password, bots use an OAuth token to log in; so you need to provide a username and OAuth token for the bot account. Once you've created the bot account, you can generate an OAuth token for it at https://twitchapps.com/tmi

### Rumpus Authentication (required)
The Rumpus API allows the bot to communicate with LevelHead. (Most importantly, this is how bookmarks are updated.) The API uses a "delegation key" to provide access to various game functions. You can manage your delegation tokens at https://www.bscotch.net/account

The bot needs a token with the following permissions:
- View own and others' Levelhead data
- View, and, and delete own Levelhead level bookmarks

### Queue Management Options
Here you can decide whether levels are taken into the queue in the order received, or whether viewers "take turns" in a rotation; configure limits on how many levels each viewer may submit; determine how to handle creator codes; and set the "default advance mode", which affects how commands like `!skip` advance the queue.

You can also set a default for the maximum number of players that a level can require and be accepted into the queue.  This default will be in effect each time you restart the bot; at any time you can override it for the remainder of the session using the `!players` command.  Setting this to 4 restores the behavior of older versions of the bot (allowing all levels).

### Chat Options
Options that control the bot's interaction with chat are found here. You can change the prefix used to recognize bot cmmands. (By default this is !, and it is recommended to use this if possible.) You can also configure message throttling. (As of version 2.2.0, it is not possible to disable throttling entirely; but you can specify the per-message delay and the 30-second message count limit.)

### Persistence Options
By default ShenaniBot does not "remember" anything from one session to the next. This means that any information the bot creates, beyond what is reported by the API, is lost each time you restart.  You can configure the bot to preserve certain information from session to session.

### Web Server Options
You can enable or diable the embedded web server. This allows you to use overlays to include information about the queue in your stream layout (provided your streaming software can be set up to display a web view, such as with OBS Browser Sources) and can be used to provide an interactive UI for choosing levels for submitted creator codes.

Once you've configured this feature, the bot will provide a URL with setup instructions at start-up. (Most of the overlay setup is done in your streaming software.)


# Running the Bot
To run the bot from an `npm`-based install open a terminal (`cmd` or `PowerShell`) or the Windows "Run" window and type the command

`shenanibot`

If you downloaded a binary, run it with no command line options to start the bot (e.g. `shenanibot.exe` for Windows).

The terminal window will show the connection process to your Twitch channel.  (You will likely see the message "error: No response from Twitch."; this is normal and the bot should still function.)

In your chat, you should see the message "Bot Connected!"

## Using Markers
Markers create "breaks" in the queue.  This can be used in a couple different ways.

Markers occupy a spot in the queue.  When a marker reaches the top of the queue, no level from the queue will be bookmarked and the queue will report that no level is currently being played.  This can be used to prevent the first submission from automatically moving to "now playing" - e.g. if you want to use `!random` to shuffle the levels.  It also allows for planned breaks from viewer levels - such as for workshop sessions, tower trials, non-LH segments, etc.

Additionally, `!random` will only consider levels up to the next marker.  (That is, if the top of the queue is a marker, it will be discarded as normal; but then a level will be chosen from those that are before the subsequent marker in the queue.)  

If you place a marker to reserve a time for some non-level activity (e.g. a level-building session, a tower trial run, a chat game, etc.), you can name the marker to indicate that purpose; the marker name will show up in `!queue` output and/or the queue overlay.  

### Markers and Priority Mode

With the default (`fifo`) priority mode, the behavior of markers is fairly straightforward.  Other priority modes change the order in which levels are played, but the positions of markers are unaffected by this process.

For example, suppose you have `PRIORITY` set to `rotation`.  One viewer has `!add`ed levels A and B to the qeueue; level A is in the "current round", and level B is in the "next round".  If you then place a marker, this schedules a break to occur after you've played two levels.  If a new viewer then submits level C, it will be added to the "current round"; it will be played after level A but before level B.  The break is scheduled to occur after two levels and the marker doesn't move; so level C is played after level A, then the break occurs, then level B is played.

This is intended to make breaks that are scheduled using markers as predictaable as possible; the only time the number of levels to be played before a scheduled break would increase is if you've configured a channel points reward with the `urgent` behavior.

## Channel Points Integration
If you are a Twitch affiliate or partner, you can configure the bot to listen for custom channel point reward redemptions using the `!reward` command.

If your bot is able to write to its `config.json` file, then the bot will automatically remember the rewards you configure.  Otherwise, the `!reward` command will log instructions for updating your configuration files; you'll find the instructions in the terminal where the bot is running.

The first step is to define a custom channel points reward for your Twitch channel.  The bot doesn't really care how you set the reward up, except the setting for Require Viewer to Enter Text must be enabled.  (This is necessary in order for the bot to see reward redemptions, and also is how the user will specify a level to be affected by the reward.)

It is not recommended to set the reward to skip the Reward Requests Queue.  The bot will attempt to fulfill the redemption automatically when it is first submitted regardless of this setting, but if the request is invalid (e.g. bad level code) the bot will have no way to refund the points; so if you want the option to refund errant redemptions, they need to go into the queue where you can handle refunds manually.

Also be aware that you may want to disable these rewards when not playing Levelhead, when the bot is not active, or when they wouldn't be applicable.  (For example, perhaps you've defined a reward with the `expedite` behavior; if you're playing a group of levels in random order then during that time you might disable that reward.)

Once you've created the custom reward in Twitch, you can use the `!reward` command to associate a specific behavior to the reward.  Each behavior can be associated with a single reward, and each reward can only be associated with a single behavior; but by setting up multiple rewards you can offer any or all of the behaviors described below.

So for example you can give the command `!reward priority` to tell the bot you want to assocaite a custom reward with the `priority` behavior so that users can have their levels played sooner in exchange for channel points.  (Note that you give this command by redeeming a custom reward with the message `!reward priority`, and then once this is done, viewers can redeem the reward with a level code for a level that is in the queue.)

You can use `!noreward` to remove the association of a behavior from a reward.  Again if the bot cannot write to its `config.json` file then you'll have to update the configuration manually for the chnage to be remembered; instructions will be logged to the terminal.

### Behaviors

`urgent` - Mark a level as "high priority" and move it to the front of the queue subject to the following rules:  The "now playing" level is not affected.  If there are other "high priority" levels at the front of the queue, the level is added after them (unless they're in a later round when using "rotation" priority).  The level must already be in the queue.

If `PRIORITY` is set to "rotation", the level's round assignment may change to be consistent with its new location in the queue.  However, for purposes of deciding what round the viewer's next submission would be added to, the level is still considered to occupy their spot in the round to which it was originally assigned.

Note that a reward with this behavior will allow levels to skip ahead of markers; so levels can be placed ahead of planned breaks from the queue, or they can be added to the existing pool of levels for `!random` (and will be chosen before any non-priority levels in the pool).  This is a suitable behavior if you want to allow viewers to occasionally ask you to play a level right away because they need to leave soon; generally you would attach a high cost to rewards with this behavior.

`priority` - Mark a level as "high priority" and move it up in the queue subject to the following rules:  The "now playing" level is not affected.  The level can not move up past a marker.  The level cannot move up past another "high priority" level.  The level must already be in the queue.  If `PRIORITY` is set to "rotation", the level cannot move up into an earlier round.

Unlike `urgent`, `priority` will not move a level past a marker; so if you use markers to play "batches" of levels, this moves a level to the front of its batch rather than the front of the entire queue.  Similarly, in "rotation" mode, this moves a level to the front of its round.

`expedite` - Move a level up one space in the queue, provided this would not affect a marker, a "high priority" level (unless the level being expedited is itself "high priority"), or the "now playing" level.  The level must already be in the queue.  If `PRIORITY` is set to "rotation", this cannot move a level into an earlier round.

This does not mark the expedited level as "high priority".  While this may be suitable as a lower-cost reward, it could potentially lead to a "tug of war" where two users each have a level in the queue and each repeatedly use this reward to move their level ahead of the other.

`unlimit` - Add the level to the queue even if the submission limit for the user would be exceeded by doing so.  All other requirements for the user to be allowed to submit the level must be met (i.e. the queue must be open unless `!permit` has been granted to the user; the level cannot already have been played or removed by the streamer).

`add` - Add the level to the queue assuming all requirements for the user to be allowed to submit the level are met.  If a reward is associated with this behavior, then the regular `!add` command is disabled and levels can only be submitted by spending channel points.


## Developers

Feel free to study JavaScript and understand the code behind the Shenanibot. Make sure to edit and modify it as much as you need or want. And if you change it, feel free to help us make the bot better by sharing your code with us. Cheers!

If you've cloned the repo (or downloaded and extracted a source ZIP), you can configure and run the bot directly from your local repo's root directory.  (This used to be the "normal" way to run the bot.)  To configure, use

`npm run configure`

and to run the bot, use

`npm run start`


## Lastly...

Shoutouts to the BS brothers for such a fantastic game!
