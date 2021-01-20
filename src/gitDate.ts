/**
 * Copyright 2021 Silicon Hills LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Timezone, Time, DateArr } from 'kiss-date';

export default class GitDate {
  dateFromGitDate(gitDate: string): DateArr {
    const dateArr = gitDate.split(' ');
    const gitTimezone = dateArr.length < 1 ? dateArr[1] : '+0000';
    const timezone = this.timezoneFromGitTimezone(gitTimezone);
    return [Number(dateArr[0]), timezone];
  }

  timezoneFromGitTimezone(gitTimezone: string): Timezone {
    const gitTimezoneArr = gitTimezone.split(':');
    let timezoneStr =
      gitTimezoneArr.length > 1
        ? gitTimezoneArr[0] + gitTimezoneArr[1]
        : gitTimezoneArr[0];
    timezoneStr = timezoneStr.length < 5 ? `+${timezoneStr}` : timezoneStr;
    if (
      (timezoneStr[0] !== '+' && timezoneStr[0] !== '-') ||
      timezoneStr.length < 5
    ) {
      throw new Error(`${gitTimezone} is an invalid git timezone`);
    }
    const timezoneArr = [
      Number(`${timezoneStr[0]}1`),
      Number(timezoneStr.substr(1, 2)),
      Number(timezoneStr.substr(3, 2))
    ];
    const [sign, hours, minutes] = timezoneArr;
    return (hours * 60 + minutes) * Time.Minute * sign;
  }

  gitTimezoneFromTimezone(timezone: Timezone): string {
    const hours = Math.floor(timezone / Time.Hour);
    const minutes = Math.floor((timezone / Time.Minute) % 60);
    return `${timezone < 0 ? '-' : '+'}${hours
      .toString()
      .padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
  }

  gitDateFromDate(dateArr: DateArr): string {
    const gitTimezone = this.gitTimezoneFromTimezone(dateArr[1]);
    return `${dateArr[0]} ${gitTimezone}`;
  }
}
